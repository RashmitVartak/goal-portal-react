import os, csv, io
from datetime import datetime, date
from flask import Flask, request, jsonify, session, Response, send_from_directory
from flask_cors import CORS
from database import get_db, init_db, seed_data
from scoring import compute_score

STATIC_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
app = Flask(__name__, static_folder=STATIC_FOLDER, static_url_path="")
app.secret_key = os.environ.get("SECRET_KEY", "goal-portal-secret-key-change-in-prod")
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_HTTPONLY"] = True
CORS(app, supports_credentials=True, origins=["http://localhost:3000", "http://localhost:5173"])

#
def row_to_dict(row):
    return dict(row) if row else None


def rows_to_list(rows):
    return [dict(r) for r in rows]


def current_user():
    if "employee_id" not in session:
        return None
    db = get_db()
    u = db.execute("SELECT employee_id,employee_name,email,department,designation,role,manager_id,is_active FROM employees WHERE employee_id=?", (session["employee_id"],)).fetchone()
    db.close()
    return row_to_dict(u)


def active_cycle():
    db = get_db()
    c = db.execute("SELECT * FROM cycles WHERE is_active=1 LIMIT 1").fetchone()
    db.close()
    return row_to_dict(c)


def get_active_window(cycle):
    if not cycle:
        return None, None
    today = date.today()
    windows = {
        "GOAL_SETTING": (cycle["goal_setting_start"], cycle["goal_setting_end"]),
        "Q1": (cycle["q1_start"], cycle["q1_end"]),
        "Q2": (cycle["q2_start"], cycle["q2_end"]),
        "Q3": (cycle["q3_start"], cycle["q3_end"]),
        "Q4": (cycle["q4_start"], cycle["q4_end"]),
    }
    for name, (start, end) in windows.items():
        if start and end:
            s = datetime.strptime(start, "%Y-%m-%d").date() if isinstance(start, str) else start
            e = datetime.strptime(end, "%Y-%m-%d").date() if isinstance(end, str) else end
            if s <= today <= e:
                return name, {"start": str(s), "end": str(e)}
    return None, None


def log_audit(entity_type, entity_id, action, changed_by, field_changed=None, old_value=None, new_value=None, reason=None):
    db = get_db()
    db.execute("INSERT INTO audit_trail (entity_type,entity_id,action,field_changed,old_value,new_value,changed_by,change_reason) VALUES (?,?,?,?,?,?,?,?)",
        (entity_type, entity_id, action, field_changed, old_value, new_value, changed_by, reason))
    db.commit()
    db.close()


def send_notif(recipient_id, ntype, title, message, etype=None, eid=None):
    db = get_db()
    db.execute("INSERT INTO notifications (recipient_id,notification_type,title,message,related_entity_type,related_entity_id) VALUES (?,?,?,?,?,?)",
        (recipient_id, ntype, title, message, etype, eid))
    db.commit()
    db.close()


def auth_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if "employee_id" not in session:
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated


def role_required(*roles):
    def decorator(f):
        from functools import wraps
        @wraps(f)
        def decorated(*args, **kwargs):
            u = current_user()
            if not u or u["role"] not in roles:
                return jsonify({"error": "Forbidden"}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator


# ── AUTH ──

@app.post("/api/login")
def login():
    data = request.json
    db = get_db()
    u = db.execute("SELECT * FROM employees WHERE employee_id=? AND password=? AND is_active=1",
        (data.get("employee_id"), data.get("password"))).fetchone()
    db.close()
    if not u:
        return jsonify({"error": "Invalid credentials"}), 401
    session["employee_id"] = u["employee_id"]
    user_dict = row_to_dict(u)
    user_dict.pop("password", None)
    return jsonify(user_dict)


@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify({"ok": True})


@app.get("/api/me")
def me():
    u = current_user()
    if not u:
        return jsonify({"error": "Not logged in"}), 401
    return jsonify(u)


# ── NOTIFICATIONS ──

@app.get("/api/notifications")
@auth_required
def get_notifications():
    db = get_db()
    notifs = db.execute("SELECT * FROM notifications WHERE recipient_id=? ORDER BY created_at DESC LIMIT 20",
        (session["employee_id"],)).fetchall()
    count = db.execute("SELECT COUNT(*) as cnt FROM notifications WHERE recipient_id=? AND is_read=0",
        (session["employee_id"],)).fetchone()["cnt"]
    db.close()
    return jsonify({"notifications": rows_to_list(notifs), "unread_count": count})


@app.post("/api/notifications/<int:nid>/read")
@auth_required
def mark_read(nid):
    db = get_db()
    db.execute("UPDATE notifications SET is_read=1 WHERE notification_id=? AND recipient_id=?", (nid, session["employee_id"]))
    db.commit()
    db.close()
    return jsonify({"ok": True})


# ── REFERENCE DATA ──

@app.get("/api/thrust-areas")
def get_thrust_areas():
    db = get_db()
    r = db.execute("SELECT * FROM thrust_areas WHERE is_active=1 ORDER BY thrust_area_name").fetchall()
    db.close()
    return jsonify(rows_to_list(r))


@app.get("/api/cycles")
def get_cycles():
    db = get_db()
    r = db.execute("SELECT * FROM cycles ORDER BY cycle_year DESC").fetchall()
    db.close()
    return jsonify(rows_to_list(r))


@app.get("/api/active-cycle")
def get_active_cycle():
    c = active_cycle()
    return jsonify(c) if c else jsonify(None)


@app.get("/api/employees")
@auth_required
def get_employees():
    db = get_db()
    r = db.execute("SELECT employee_id,employee_name,email,department,designation,role,manager_id,is_active FROM employees ORDER BY employee_name").fetchall()
    db.close()
    return jsonify(rows_to_list(r))


# ── DASHBOARD ──

@app.get("/api/dashboard")
@auth_required
def dashboard():
    u = current_user()
    cycle = active_cycle()
    db = get_db()
    sheet = None
    goals = []
    team_pending = 0
    if cycle:
        s = db.execute("SELECT * FROM goal_sheets WHERE employee_id=? AND cycle_id=?", (u["employee_id"], cycle["cycle_id"])).fetchone()
        sheet = row_to_dict(s)
        if sheet:
            goals = rows_to_list(db.execute("SELECT g.*,t.thrust_area_name FROM goals g LEFT JOIN thrust_areas t ON g.thrust_area_id=t.thrust_area_id WHERE g.sheet_id=? ORDER BY g.goal_id", (sheet["sheet_id"],)).fetchall())
        if u["role"] in ("MANAGER", "ADMIN"):
            team_pending = db.execute("SELECT COUNT(*) as cnt FROM goal_sheets gs JOIN employees e ON gs.employee_id=e.employee_id WHERE e.manager_id=? AND gs.cycle_id=? AND gs.status='SUBMITTED'",
                (u["employee_id"], cycle["cycle_id"])).fetchone()["cnt"]
    shared = []
    if cycle:
        existing_ids = [g.get("shared_goal_id", 0) or 0 for g in goals] if goals else []
        all_sg = rows_to_list(db.execute("SELECT sg.*,t.thrust_area_name FROM shared_goals sg LEFT JOIN thrust_areas t ON sg.thrust_area_id=t.thrust_area_id WHERE sg.is_active=1").fetchall())
        user_dept = (u["department"] or "").strip().lower()
        shared = [sg for sg in all_sg if sg["shared_goal_id"] not in existing_ids and (not sg["department"] or sg["department"].strip().lower() == user_dept)]
    db.close()
    window, window_dates = get_active_window(cycle) if cycle else (None, None)
    return jsonify({"user": u, "cycle": cycle, "sheet": sheet, "goals": goals, "team_pending": team_pending, "shared_goals": shared, "active_window": window, "window_dates": window_dates})


# ── GOAL SHEET ──

@app.get("/api/debug/shared-goals")
@auth_required
def debug_shared_goals():
    u = current_user()
    db = get_db()
    all_sg = rows_to_list(db.execute("SELECT * FROM shared_goals").fetchall())
    cycle = active_cycle()
    sheet = None
    existing_ids = []
    if cycle:
        s = db.execute("SELECT * FROM goal_sheets WHERE employee_id=? AND cycle_id=?", (u["employee_id"], cycle["cycle_id"])).fetchone()
        if s:
            sheet = row_to_dict(s)
            goals = rows_to_list(db.execute("SELECT shared_goal_id FROM goals WHERE sheet_id=?", (s["sheet_id"],)).fetchall())
            existing_ids = [g["shared_goal_id"] for g in goals if g["shared_goal_id"]]
    db.close()
    return jsonify({
        "user_dept": u["department"],
        "all_shared_goals": all_sg,
        "existing_ids_in_sheet": existing_ids,
        "has_sheet": sheet is not None,
        "sheet_status": sheet["status"] if sheet else None,
    })


@app.post("/api/goal-sheets")
@auth_required
def create_sheet():
    cycle = active_cycle()
    if not cycle:
        return jsonify({"error": "No active cycle"}), 400
    db = get_db()
    existing = db.execute("SELECT * FROM goal_sheets WHERE employee_id=? AND cycle_id=?", (session["employee_id"], cycle["cycle_id"])).fetchone()
    if not existing:
        db.execute("INSERT INTO goal_sheets (employee_id,cycle_id,status) VALUES (?,?,'DRAFT')", (session["employee_id"], cycle["cycle_id"]))
        db.commit()
    db.close()
    return jsonify({"ok": True})


@app.post("/api/goal-sheets/submit")
@auth_required
def submit_sheet():
    cycle = active_cycle()
    db = get_db()
    sheet = db.execute("SELECT * FROM goal_sheets WHERE employee_id=? AND cycle_id=?", (session["employee_id"], cycle["cycle_id"])).fetchone()
    if not sheet or sheet["status"] not in ("DRAFT", "RETURNED"):
        db.close()
        return jsonify({"error": "Cannot submit"}), 400
    total = db.execute("SELECT COALESCE(SUM(weightage),0) as total FROM goals WHERE sheet_id=?", (sheet["sheet_id"],)).fetchone()["total"]
    if total != 100:
        db.close()
        return jsonify({"error": f"Total weightage must be 100%. Current: {total}%"}), 400
    db.execute("UPDATE goal_sheets SET status='SUBMITTED',submitted_at=datetime('now'),updated_at=datetime('now') WHERE sheet_id=?", (sheet["sheet_id"],))
    db.commit()
    u = current_user()
    if u["manager_id"]:
        send_notif(u["manager_id"], "GOAL_SUBMITTED", "Goal Sheet Submitted", f"{u['employee_name']} submitted goals for review.", "GOAL_SHEET", sheet["sheet_id"])
    log_audit("GOAL_SHEET", sheet["sheet_id"], "SUBMIT", session["employee_id"])
    db.close()
    return jsonify({"ok": True})


# ── GOALS CRUD ──

@app.post("/api/goals")
@auth_required
def add_goal():
    cycle = active_cycle()
    db = get_db()
    sheet = db.execute("SELECT * FROM goal_sheets WHERE employee_id=? AND cycle_id=?", (session["employee_id"], cycle["cycle_id"])).fetchone()
    if not sheet or sheet["status"] not in ("DRAFT", "RETURNED"):
        db.close()
        return jsonify({"error": "Cannot add goals"}), 400
    cnt = db.execute("SELECT COUNT(*) as cnt FROM goals WHERE sheet_id=?", (sheet["sheet_id"],)).fetchone()["cnt"]
    if cnt >= 8:
        db.close()
        return jsonify({"error": "Maximum 8 goals allowed"}), 400
    d = request.json
    w = float(d.get("weightage", 0))
    if w < 10:
        db.close()
        return jsonify({"error": "Minimum weightage is 10%"}), 400
    cur_total = db.execute("SELECT COALESCE(SUM(weightage),0) as total FROM goals WHERE sheet_id=?", (sheet["sheet_id"],)).fetchone()["total"]
    if cur_total + w > 100:
        db.close()
        return jsonify({"error": f"Total weightage would exceed 100% (current: {cur_total}%)"}), 400
    db.execute("INSERT INTO goals (sheet_id,thrust_area_id,goal_title,goal_description,uom_type,target_value,weightage) VALUES (?,?,?,?,?,?,?)",
        (sheet["sheet_id"], d.get("thrust_area_id"), d["goal_title"], d.get("goal_description",""), d["uom_type"], d["target_value"], w))
    db.commit()
    log_audit("GOAL", 0, "CREATE", session["employee_id"], "goal_title", None, d["goal_title"])
    db.close()
    return jsonify({"ok": True})


@app.put("/api/goals/<int:gid>")
@auth_required
def edit_goal(gid):
    db = get_db()
    g = db.execute("SELECT g.*,gs.employee_id,gs.status FROM goals g JOIN goal_sheets gs ON g.sheet_id=gs.sheet_id WHERE g.goal_id=?", (gid,)).fetchone()
    if not g or g["employee_id"] != session["employee_id"] or g["status"] not in ("DRAFT", "RETURNED"):
        db.close()
        return jsonify({"error": "Cannot edit"}), 400
    d = request.json
    w = float(d.get("weightage", g["weightage"]))
    if w < 10:
        db.close()
        return jsonify({"error": "Minimum weightage is 10%"}), 400
    if g["is_shared"]:
        db.execute("UPDATE goals SET weightage=?,updated_at=datetime('now') WHERE goal_id=?", (w, gid))
    else:
        db.execute("UPDATE goals SET goal_title=?,goal_description=?,thrust_area_id=?,uom_type=?,target_value=?,weightage=?,updated_at=datetime('now') WHERE goal_id=?",
            (d.get("goal_title", g["goal_title"]), d.get("goal_description",""), d.get("thrust_area_id"), d.get("uom_type", g["uom_type"]), d.get("target_value", g["target_value"]), w, gid))
    db.commit()
    log_audit("GOAL", gid, "EDIT", session["employee_id"])
    db.close()
    return jsonify({"ok": True})


@app.delete("/api/goals/<int:gid>")
@auth_required
def delete_goal(gid):
    db = get_db()
    g = db.execute("SELECT g.*,gs.employee_id,gs.status FROM goals g JOIN goal_sheets gs ON g.sheet_id=gs.sheet_id WHERE g.goal_id=?", (gid,)).fetchone()
    if not g or g["employee_id"] != session["employee_id"] or g["status"] not in ("DRAFT", "RETURNED"):
        db.close()
        return jsonify({"error": "Cannot delete"}), 400
    db.execute("DELETE FROM goals WHERE goal_id=?", (gid,))
    db.commit()
    log_audit("GOAL", gid, "DELETE", session["employee_id"])
    db.close()
    return jsonify({"ok": True})


@app.post("/api/goals/add-shared/<int:sgid>")
@auth_required
def add_shared_goal(sgid):
    cycle = active_cycle()
    db = get_db()
    sheet = db.execute("SELECT * FROM goal_sheets WHERE employee_id=? AND cycle_id=?", (session["employee_id"], cycle["cycle_id"])).fetchone()
    sg = db.execute("SELECT * FROM shared_goals WHERE shared_goal_id=?", (sgid,)).fetchone()
    if not sheet or not sg:
        db.close()
        return jsonify({"error": "Error"}), 400
    cnt = db.execute("SELECT COUNT(*) as cnt FROM goals WHERE sheet_id=?", (sheet["sheet_id"],)).fetchone()["cnt"]
    if cnt >= 8:
        db.close()
        return jsonify({"error": "Maximum 8 goals"}), 400
    w = float(request.json.get("weightage", 10))
    db.execute("INSERT INTO goals (sheet_id,thrust_area_id,goal_title,goal_description,uom_type,target_value,weightage,is_shared,shared_goal_id,is_primary_owner) VALUES (?,?,?,?,?,?,?,1,?,0)",
        (sheet["sheet_id"], sg["thrust_area_id"], sg["source_goal_title"], sg["source_goal_description"], sg["uom_type"], sg["target_value"], w, sgid))
    db.commit()
    db.close()
    return jsonify({"ok": True})


# ── MANAGER APPROVAL ──

@app.get("/api/manager/approvals")
@auth_required
@role_required("MANAGER", "ADMIN")
def get_approvals():
    u = current_user()
    cycle = active_cycle()
    db = get_db()
    result = []
    if cycle:
        sheets = db.execute("SELECT gs.*,e.employee_name,e.department,e.designation FROM goal_sheets gs JOIN employees e ON gs.employee_id=e.employee_id WHERE e.manager_id=? AND gs.cycle_id=? AND gs.status='SUBMITTED' ORDER BY gs.submitted_at",
            (u["employee_id"], cycle["cycle_id"])).fetchall()
        for s in sheets:
            goals = rows_to_list(db.execute("SELECT g.*,t.thrust_area_name FROM goals g LEFT JOIN thrust_areas t ON g.thrust_area_id=t.thrust_area_id WHERE g.sheet_id=? ORDER BY g.goal_id", (s["sheet_id"],)).fetchall())
            result.append({"sheet": row_to_dict(s), "goals": goals, "total_weight": sum(g["weightage"] for g in goals)})
    db.close()
    return jsonify(result)


@app.post("/api/manager/approve/<int:sid>")
@auth_required
@role_required("MANAGER", "ADMIN")
def approve_sheet(sid):
    db = get_db()
    sheet = db.execute("SELECT * FROM goal_sheets WHERE sheet_id=?", (sid,)).fetchone()
    db.execute("UPDATE goal_sheets SET status='APPROVED',is_locked=1,approved_at=datetime('now'),approved_by=?,updated_at=datetime('now') WHERE sheet_id=?", (session["employee_id"], sid))
    db.commit()
    send_notif(sheet["employee_id"], "GOAL_APPROVED", "Goals Approved", "Your goal sheet has been approved.", "GOAL_SHEET", sid)
    log_audit("GOAL_SHEET", sid, "APPROVE", session["employee_id"])
    db.close()
    return jsonify({"ok": True})


@app.post("/api/manager/return/<int:sid>")
@auth_required
@role_required("MANAGER", "ADMIN")
def return_sheet(sid):
    reason = request.json.get("reason", "")
    db = get_db()
    sheet = db.execute("SELECT * FROM goal_sheets WHERE sheet_id=?", (sid,)).fetchone()
    db.execute("UPDATE goal_sheets SET status='RETURNED',rejection_reason=?,updated_at=datetime('now') WHERE sheet_id=?", (reason, sid))
    db.commit()
    send_notif(sheet["employee_id"], "GOAL_RETURNED", "Goals Returned", f"Returned: {reason}", "GOAL_SHEET", sid)
    log_audit("GOAL_SHEET", sid, "RETURN", session["employee_id"])
    db.close()
    return jsonify({"ok": True})


@app.put("/api/manager/goals/<int:gid>")
@auth_required
@role_required("MANAGER", "ADMIN")
def manager_edit_goal(gid):
    d = request.json
    db = get_db()
    g = db.execute("SELECT * FROM goals WHERE goal_id=?", (gid,)).fetchone()
    db.execute("UPDATE goals SET target_value=?,weightage=?,updated_at=datetime('now') WHERE goal_id=?",
        (d.get("target_value", g["target_value"]), float(d.get("weightage", g["weightage"])), gid))
    db.commit()
    log_audit("GOAL", gid, "MANAGER_EDIT", session["employee_id"], "target_value", g["target_value"], d.get("target_value"))
    db.close()
    return jsonify({"ok": True})


# ── ACHIEVEMENTS ──

@app.get("/api/achievements")
@auth_required
def get_achievements():
    u = current_user()
    cycle = active_cycle()
    db = get_db()
    sheet = None
    goals = []
    if cycle:
        s = db.execute("SELECT * FROM goal_sheets WHERE employee_id=? AND cycle_id=? AND status='APPROVED'", (u["employee_id"], cycle["cycle_id"])).fetchone()
        sheet = row_to_dict(s)
        if sheet:
            goals = rows_to_list(db.execute("SELECT g.*,t.thrust_area_name FROM goals g LEFT JOIN thrust_areas t ON g.thrust_area_id=t.thrust_area_id WHERE g.sheet_id=? ORDER BY g.goal_id", (sheet["sheet_id"],)).fetchall())
    db.close()
    return jsonify({"sheet": sheet, "goals": goals, "cycle": cycle})


@app.post("/api/achievements/<int:gid>")
@auth_required
def update_achievement(gid):
    d = request.json
    quarter = d["quarter"]
    actual = d.get("actual", "")
    status_val = d.get("status", "NOT_STARTED")
    db = get_db()
    g = db.execute("SELECT * FROM goals WHERE goal_id=?", (gid,)).fetchone()
    if not g:
        db.close()
        return jsonify({"error": "Not found"}), 404
    score = compute_score(g["uom_type"], g["target_value"], actual)
    q = quarter.lower()
    db.execute(f"UPDATE goals SET {q}_actual=?,{q}_status=?,{q}_score=?,updated_at=datetime('now') WHERE goal_id=?", (actual, status_val, score, gid))
    if g["is_shared"] and g["is_primary_owner"] and g["shared_goal_id"]:
        linked = db.execute("SELECT goal_id FROM goals WHERE shared_goal_id=? AND goal_id!=?", (g["shared_goal_id"], gid)).fetchall()
        for lg in linked:
            db.execute(f"UPDATE goals SET {q}_actual=?,{q}_status=?,{q}_score=?,updated_at=datetime('now') WHERE goal_id=?", (actual, status_val, score, lg["goal_id"]))
    db.commit()
    log_audit("GOAL", gid, f"{quarter}_UPDATE", session["employee_id"], f"{q}_actual", None, actual)
    db.close()
    return jsonify({"ok": True, "score": score})


# ── MANAGER CHECKINS ──

@app.get("/api/manager/checkins")
@auth_required
@role_required("MANAGER", "ADMIN")
def get_checkins():
    u = current_user()
    cycle = active_cycle()
    quarter = request.args.get("quarter", "Q1")
    db = get_db()
    team = []
    if cycle:
        members = db.execute("SELECT e.employee_id,e.employee_name,e.email,e.department,e.designation,e.role,e.manager_id,gs.sheet_id,gs.status as goal_status FROM employees e LEFT JOIN goal_sheets gs ON e.employee_id=gs.employee_id AND gs.cycle_id=? WHERE e.manager_id=? AND e.is_active=1 ORDER BY e.employee_name",
            (cycle["cycle_id"], u["employee_id"])).fetchall()
        for m in members:
            md = row_to_dict(m)
            goals = []
            comments = []
            weighted_score = 0
            if m["sheet_id"] and m["goal_status"] == "APPROVED":
                goals = rows_to_list(db.execute("SELECT g.*,t.thrust_area_name FROM goals g LEFT JOIN thrust_areas t ON g.thrust_area_id=t.thrust_area_id WHERE g.sheet_id=? ORDER BY g.goal_id", (m["sheet_id"],)).fetchall())
                comments = rows_to_list(db.execute("SELECT * FROM checkin_comments WHERE sheet_id=? AND quarter=? ORDER BY created_at DESC", (m["sheet_id"], quarter)).fetchall())
                q = quarter.lower()
                for g in goals:
                    if g[f"{q}_score"] is not None:
                        weighted_score += g[f"{q}_score"] * g["weightage"] / 100
            team.append({"member": md, "goals": goals, "comments": comments, "weighted_score": round(weighted_score, 1)})
    db.close()
    return jsonify(team)


@app.post("/api/manager/checkins/comment")
@auth_required
@role_required("MANAGER", "ADMIN")
def add_comment():
    d = request.json
    db = get_db()
    db.execute("INSERT INTO checkin_comments (sheet_id,quarter,manager_id,comment_text) VALUES (?,?,?,?)",
        (d["sheet_id"], d["quarter"], session["employee_id"], d["comment"].strip()))
    db.commit()
    log_audit("CHECKIN", d["sheet_id"], f"{d['quarter']}_CHECKIN", session["employee_id"], new_value=d["comment"])
    db.close()
    return jsonify({"ok": True})


# ── ADMIN ──

@app.get("/api/admin/data")
@auth_required
@role_required("ADMIN")
def admin_data():
    db = get_db()
    cycle = active_cycle()
    locked = []
    if cycle:
        locked = rows_to_list(db.execute("SELECT gs.sheet_id,e.employee_name FROM goal_sheets gs JOIN employees e ON gs.employee_id=e.employee_id WHERE gs.cycle_id=? AND gs.is_locked=1", (cycle["cycle_id"],)).fetchall())
    data = {
        "cycles": rows_to_list(db.execute("SELECT * FROM cycles ORDER BY cycle_year DESC").fetchall()),
        "employees": rows_to_list(db.execute("SELECT employee_id,employee_name,email,department,designation,role,manager_id,is_active FROM employees ORDER BY employee_name").fetchall()),
        "thrust_areas": rows_to_list(db.execute("SELECT * FROM thrust_areas ORDER BY thrust_area_name").fetchall()),
        "shared_goals": rows_to_list(db.execute("SELECT sg.*,t.thrust_area_name FROM shared_goals sg LEFT JOIN thrust_areas t ON sg.thrust_area_id=t.thrust_area_id WHERE sg.is_active=1 ORDER BY sg.created_at DESC").fetchall()),
        "audit": rows_to_list(db.execute("SELECT * FROM audit_trail ORDER BY created_at DESC LIMIT 100").fetchall()),
        "locked_sheets": locked,
    }
    db.close()
    return jsonify(data)


@app.post("/api/admin/employees")
@auth_required
@role_required("ADMIN")
def add_employee():
    d = request.json
    db = get_db()
    db.execute("INSERT INTO employees (employee_id,employee_name,email,department,designation,role,manager_id,password) VALUES (?,?,?,?,?,?,?,?)",
        (d["employee_id"], d["employee_name"], d.get("email",""), d.get("department",""), d.get("designation",""), d.get("role","EMPLOYEE"), d.get("manager_id") or None, d.get("password","password123")))
    db.commit()
    db.close()
    return jsonify({"ok": True})


@app.post("/api/admin/cycles")
@auth_required
@role_required("ADMIN")
def add_cycle():
    d = request.json
    db = get_db()
    db.execute("UPDATE cycles SET is_active=0 WHERE is_active=1")
    db.execute("INSERT INTO cycles (cycle_name,cycle_year,goal_setting_start,goal_setting_end,q1_start,q1_end,q2_start,q2_end,q3_start,q3_end,q4_start,q4_end,is_active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)",
        (d["cycle_name"], int(d["cycle_year"]), d["goal_setting_start"], d["goal_setting_end"], d["q1_start"], d["q1_end"], d["q2_start"], d["q2_end"], d["q3_start"], d["q3_end"], d["q4_start"], d["q4_end"]))
    db.commit()
    db.close()
    return jsonify({"ok": True})


@app.post("/api/admin/thrust-areas")
@auth_required
@role_required("ADMIN")
def add_thrust_area():
    d = request.json
    db = get_db()
    db.execute("INSERT INTO thrust_areas (thrust_area_name,description) VALUES (?,?)", (d["name"], d.get("description","")))
    db.commit()
    db.close()
    return jsonify({"ok": True})


@app.put("/api/admin/thrust-areas/<int:tid>")
@auth_required
@role_required("ADMIN")
def edit_thrust_area(tid):
    d = request.json
    db = get_db()
    db.execute("UPDATE thrust_areas SET thrust_area_name=?,description=? WHERE thrust_area_id=?", (d["name"], d.get("description",""), tid))
    db.commit()
    db.close()
    return jsonify({"ok": True})


@app.delete("/api/admin/employees/<emp_id>")
@auth_required
@role_required("ADMIN")
def delete_employee(emp_id):
    db = get_db()
    db.execute("UPDATE employees SET is_active=0 WHERE employee_id=?", (emp_id,))
    db.commit()
    db.close()
    return jsonify({"ok": True})


@app.post("/api/admin/shared-goals")
@auth_required
@role_required("ADMIN", "MANAGER")
def admin_add_shared_goal():
    d = request.json
    db = get_db()
    db.execute("INSERT INTO shared_goals (source_goal_title,source_goal_description,thrust_area_id,uom_type,target_value,created_by,department) VALUES (?,?,?,?,?,?,?)",
        (d["title"], d.get("description",""), d.get("thrust_area_id") or None, d["uom_type"], d["target_value"], session["employee_id"], d.get("department") or None))
    db.commit()
    db.close()
    return jsonify({"ok": True})


@app.put("/api/admin/shared-goals/<int:sgid>")
@auth_required
@role_required("ADMIN")
def edit_shared_goal(sgid):
    d = request.json
    db = get_db()
    db.execute("UPDATE shared_goals SET source_goal_title=?,source_goal_description=?,thrust_area_id=?,uom_type=?,target_value=?,department=? WHERE shared_goal_id=?",
        (d["title"], d.get("description",""), d.get("thrust_area_id") or None, d["uom_type"], d["target_value"], d.get("department") or None, sgid))
    db.commit()
    db.close()
    return jsonify({"ok": True})


@app.delete("/api/admin/shared-goals/<int:sgid>")
@auth_required
@role_required("ADMIN")
def delete_shared_goal(sgid):
    db = get_db()
    db.execute("UPDATE shared_goals SET is_active=0 WHERE shared_goal_id=?", (sgid,))
    db.commit()
    db.close()
    return jsonify({"ok": True})


@app.post("/api/admin/unlock/<int:sid>")
@auth_required
@role_required("ADMIN")
def unlock_sheet(sid):
    reason = request.json.get("reason", "")
    db = get_db()
    db.execute("UPDATE goal_sheets SET is_locked=0,status='DRAFT',updated_at=datetime('now') WHERE sheet_id=?", (sid,))
    db.commit()
    log_audit("GOAL_SHEET", sid, "ADMIN_UNLOCK", session["employee_id"], reason=reason)
    db.close()
    return jsonify({"ok": True})


def get_visible_employee_ids(user, db):
    if user["role"] == "ADMIN":
        return None
    if user["role"] == "MANAGER":
        rows = db.execute("SELECT employee_id FROM employees WHERE manager_id=? AND is_active=1", (user["employee_id"],)).fetchall()
        ids = [r["employee_id"] for r in rows]
        ids.append(user["employee_id"])
        return ids
    return [user["employee_id"]]


# ── REPORTS ──

@app.get("/api/reports")
@auth_required
def reports():
    cycle = active_cycle()
    u = current_user()
    if not cycle:
        return jsonify({"report": [], "completion": {}, "checkins": {}, "role": u["role"]})
    db = get_db()
    visible_ids = get_visible_employee_ids(u, db)

    if visible_ids is None:
        emp_filter = ""
        emp_params = (cycle["cycle_id"],)
        report_extra = ""
        report_params = (cycle["cycle_id"],)
    else:
        ph = ",".join(["?" for _ in visible_ids])
        emp_filter = f" AND e.employee_id IN ({ph})"
        emp_params = (cycle["cycle_id"], *visible_ids)
        report_extra = f" AND e.employee_id IN ({ph})"
        report_params = (cycle["cycle_id"], *visible_ids)

    report = rows_to_list(db.execute(f"""
        SELECT e.employee_id,e.employee_name,e.department,e.designation,g.goal_title,g.uom_type,g.target_value,g.weightage,
            g.q1_actual,g.q1_score,g.q2_actual,g.q2_score,g.q3_actual,g.q3_score,g.q4_actual,g.q4_score
        FROM goals g JOIN goal_sheets gs ON g.sheet_id=gs.sheet_id JOIN employees e ON gs.employee_id=e.employee_id
        WHERE gs.cycle_id=? AND gs.status='APPROVED'{report_extra} ORDER BY e.employee_name,g.goal_title
    """, report_params).fetchall())

    all_emps = db.execute(f"SELECT e.employee_id,e.department,gs.status as goal_status,gs.sheet_id FROM employees e LEFT JOIN goal_sheets gs ON e.employee_id=gs.employee_id AND gs.cycle_id=? WHERE e.is_active=1{emp_filter}", emp_params).fetchall()
    total = len(all_emps)
    submitted = sum(1 for e in all_emps if e["goal_status"] in ("SUBMITTED","APPROVED"))
    approved = sum(1 for e in all_emps if e["goal_status"] == "APPROVED")
    not_started = sum(1 for e in all_emps if e["goal_status"] is None)
    by_dept = {}
    for e in all_emps:
        d = e["department"] or "Unknown"
        by_dept.setdefault(d, {"total": 0, "approved": 0})
        by_dept[d]["total"] += 1
        if e["goal_status"] == "APPROVED":
            by_dept[d]["approved"] += 1
    checkin_data = {}
    for q in ["Q1","Q2","Q3","Q4"]:
        sheets = [e["sheet_id"] for e in all_emps if e["goal_status"] == "APPROVED" and e["sheet_id"]]
        done = 0
        if sheets:
            ph2 = ",".join(["?" for _ in sheets])
            done = db.execute(f"SELECT COUNT(DISTINCT sheet_id) as cnt FROM checkin_comments WHERE quarter=? AND sheet_id IN ({ph2})", (q, *sheets)).fetchone()["cnt"]
        checkin_data[q] = {"done": done, "total": len(sheets)}
    db.close()
    return jsonify({"report": report, "completion": {"total": total, "submitted": submitted, "approved": approved, "not_started": not_started, "by_dept": by_dept}, "checkins": checkin_data, "cycle": cycle, "role": u["role"], "department": u["department"]})


@app.get("/api/reports/export")
@auth_required
def export_csv():
    cycle = active_cycle()
    u = current_user()
    if not cycle:
        return "No active cycle", 404
    db = get_db()
    visible_ids = get_visible_employee_ids(u, db)
    if visible_ids is None:
        data = db.execute("SELECT e.employee_id,e.employee_name,e.department,e.designation,g.goal_title,g.uom_type,g.target_value,g.weightage,g.q1_actual,g.q1_score,g.q2_actual,g.q2_score,g.q3_actual,g.q3_score,g.q4_actual,g.q4_score FROM goals g JOIN goal_sheets gs ON g.sheet_id=gs.sheet_id JOIN employees e ON gs.employee_id=e.employee_id WHERE gs.cycle_id=? AND gs.status='APPROVED' ORDER BY e.employee_name", (cycle["cycle_id"],)).fetchall()
    else:
        ph = ",".join(["?" for _ in visible_ids])
        data = db.execute(f"SELECT e.employee_id,e.employee_name,e.department,e.designation,g.goal_title,g.uom_type,g.target_value,g.weightage,g.q1_actual,g.q1_score,g.q2_actual,g.q2_score,g.q3_actual,g.q3_score,g.q4_actual,g.q4_score FROM goals g JOIN goal_sheets gs ON g.sheet_id=gs.sheet_id JOIN employees e ON gs.employee_id=e.employee_id WHERE gs.cycle_id=? AND gs.status='APPROVED' AND e.employee_id IN ({ph}) ORDER BY e.employee_name", (cycle["cycle_id"], *visible_ids)).fetchall()
    db.close()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Employee ID","Name","Department","Designation","Goal","UoM","Target","Weight%","Q1 Actual","Q1 Score","Q2 Actual","Q2 Score","Q3 Actual","Q3 Score","Q4 Actual","Q4 Score"])
    for r in data:
        writer.writerow([r["employee_id"],r["employee_name"],r["department"],r["designation"],r["goal_title"],r["uom_type"],r["target_value"],r["weightage"],r["q1_actual"],r["q1_score"],r["q2_actual"],r["q2_score"],r["q3_actual"],r["q3_score"],r["q4_actual"],r["q4_score"]])
    return Response(output.getvalue(), mimetype="text/csv", headers={"Content-Disposition": f"attachment;filename=report_{cycle['cycle_name']}.csv"})


# ── ANALYTICS ──

@app.get("/api/analytics")
@auth_required
def analytics():
    cycle = active_cycle()
    u = current_user()
    if not cycle:
        return jsonify({"qoq": [], "dist_ta": [], "dist_uom": [], "heatmap": [], "mgr_eff": [], "role": u["role"]})
    db = get_db()
    visible_ids = get_visible_employee_ids(u, db)

    if visible_ids is None:
        goals_data = db.execute("""
            SELECT e.employee_name,e.department,g.weightage,g.uom_type,t.thrust_area_name,
                g.q1_score,g.q2_score,g.q3_score,g.q4_score
            FROM goals g JOIN goal_sheets gs ON g.sheet_id=gs.sheet_id JOIN employees e ON gs.employee_id=e.employee_id
            LEFT JOIN thrust_areas t ON g.thrust_area_id=t.thrust_area_id WHERE gs.cycle_id=? AND gs.status='APPROVED'
        """, (cycle["cycle_id"],)).fetchall()
    else:
        ph = ",".join(["?" for _ in visible_ids])
        goals_data = db.execute(f"""
            SELECT e.employee_name,e.department,g.weightage,g.uom_type,t.thrust_area_name,
                g.q1_score,g.q2_score,g.q3_score,g.q4_score
            FROM goals g JOIN goal_sheets gs ON g.sheet_id=gs.sheet_id JOIN employees e ON gs.employee_id=e.employee_id
            LEFT JOIN thrust_areas t ON g.thrust_area_id=t.thrust_area_id WHERE gs.cycle_id=? AND gs.status='APPROVED' AND e.employee_id IN ({ph})
        """, (cycle["cycle_id"], *visible_ids)).fetchall()
    qoq = []
    dist_ta = []
    dist_uom = []
    heatmap = []
    if goals_data:
        for q in ["Q1","Q2","Q3","Q4"]:
            col = f"{q.lower()}_score"
            scores = [g[col] for g in goals_data if g[col] is not None]
            qoq.append({"quarter": q, "avg_score": round(sum(scores)/len(scores),1) if scores else 0, "count": len(scores)})
        ta_c, uom_c = {}, {}
        for g in goals_data:
            ta = g["thrust_area_name"] or "Unassigned"
            ta_c[ta] = ta_c.get(ta,0)+1
            uom_c[g["uom_type"]] = uom_c.get(g["uom_type"],0)+1
        dist_ta = [{"name":k,"count":v} for k,v in sorted(ta_c.items())]
        dist_uom = [{"name":k,"count":v} for k,v in sorted(uom_c.items())]
        emp_scores = {}
        for g in goals_data:
            key = (g["employee_name"], g["department"])
            emp_scores.setdefault(key, {"q1":[],"q2":[],"q3":[],"q4":[]})
            for q in ["q1","q2","q3","q4"]:
                if g[f"{q}_score"] is not None:
                    emp_scores[key][q].append(g[f"{q}_score"])
        for (name,dept),scores in sorted(emp_scores.items()):
            heatmap.append({"name":name,"department":dept,
                "q1":round(sum(scores["q1"])/len(scores["q1"]),1) if scores["q1"] else None,
                "q2":round(sum(scores["q2"])/len(scores["q2"]),1) if scores["q2"] else None,
                "q3":round(sum(scores["q3"])/len(scores["q3"]),1) if scores["q3"] else None,
                "q4":round(sum(scores["q4"])/len(scores["q4"]),1) if scores["q4"] else None})
    if visible_ids is None:
        mgr_eff = rows_to_list(db.execute("""
            SELECT m.employee_name as manager_name,m.department,COUNT(DISTINCT gs.sheet_id) as total_sheets,
                COUNT(DISTINCT CASE WHEN gs.status='APPROVED' THEN gs.sheet_id END) as approved,
                COUNT(DISTINCT cc.comment_id) as checkin_comments
            FROM employees e JOIN employees m ON e.manager_id=m.employee_id
            LEFT JOIN goal_sheets gs ON e.employee_id=gs.employee_id AND gs.cycle_id=?
            LEFT JOIN checkin_comments cc ON gs.sheet_id=cc.sheet_id
            WHERE m.role IN ('MANAGER','ADMIN') GROUP BY m.employee_name,m.department ORDER BY m.employee_name
        """, (cycle["cycle_id"],)).fetchall())
    else:
        mgr_eff = []
    db.close()
    return jsonify({"qoq":qoq,"dist_ta":dist_ta,"dist_uom":dist_uom,"heatmap":heatmap,"mgr_eff":mgr_eff,"role":u["role"],"department":u["department"]})


# ── ESCALATION ──

@app.get("/api/escalation")
@auth_required
@role_required("ADMIN")
def escalation_data():
    cycle = active_cycle()
    db = get_db()
    rules = rows_to_list(db.execute("SELECT * FROM escalation_rules ORDER BY trigger_condition,escalation_level").fetchall())
    log = []
    if cycle:
        log = rows_to_list(db.execute("SELECT el.*,e.employee_name,er.rule_name FROM escalation_log el JOIN employees e ON el.employee_id=e.employee_id JOIN escalation_rules er ON el.rule_id=er.rule_id WHERE el.cycle_id=? ORDER BY el.created_at DESC", (cycle["cycle_id"],)).fetchall())
    db.close()
    return jsonify({"rules": rules, "log": log})


@app.post("/api/escalation/run")
@auth_required
@role_required("ADMIN")
def run_escalation():
    cycle = active_cycle()
    if not cycle:
        return jsonify({"error": "No active cycle"}), 400
    db = get_db()
    rules = db.execute("SELECT * FROM escalation_rules WHERE is_active=1").fetchall()
    emps = db.execute("SELECT e.employee_id,e.employee_name,e.manager_id,gs.sheet_id,gs.status,gs.submitted_at FROM employees e LEFT JOIN goal_sheets gs ON e.employee_id=gs.employee_id AND gs.cycle_id=? WHERE e.is_active=1 AND e.role='EMPLOYEE'", (cycle["cycle_id"],)).fetchall()
    today = date.today()
    gs_date = datetime.strptime(cycle["goal_setting_start"], "%Y-%m-%d").date() if cycle["goal_setting_start"] else today
    count = 0
    for rule in rules:
        for emp in emps:
            should = False
            if rule["trigger_condition"] == "GOAL_NOT_SUBMITTED":
                if emp["status"] is None or emp["status"] == "DRAFT":
                    if (today - gs_date).days >= rule["days_threshold"]:
                        should = True
            elif rule["trigger_condition"] == "GOAL_NOT_APPROVED":
                if emp["status"] == "SUBMITTED" and emp["submitted_at"]:
                    sub = datetime.strptime(emp["submitted_at"][:10], "%Y-%m-%d").date()
                    if (today - sub).days >= rule["days_threshold"]:
                        should = True
            elif rule["trigger_condition"] == "CHECKIN_NOT_COMPLETED":
                if emp["status"] == "APPROVED" and emp["sheet_id"]:
                    for q, sk in [("Q1","q1_start"),("Q2","q2_start"),("Q3","q3_start"),("Q4","q4_start")]:
                        qs = cycle[sk]
                        if qs and today >= datetime.strptime(qs,"%Y-%m-%d").date() and (today-datetime.strptime(qs,"%Y-%m-%d").date()).days >= rule["days_threshold"]:
                            chk = db.execute("SELECT COUNT(*) as cnt FROM checkin_comments WHERE sheet_id=? AND quarter=?", (emp["sheet_id"],q)).fetchone()["cnt"]
                            if chk == 0:
                                should = True
            if should:
                ex = db.execute("SELECT COUNT(*) as cnt FROM escalation_log WHERE rule_id=? AND employee_id=? AND cycle_id=? AND status='OPEN'", (rule["rule_id"], emp["employee_id"], cycle["cycle_id"])).fetchone()["cnt"]
                if ex == 0:
                    db.execute("INSERT INTO escalation_log (rule_id,employee_id,cycle_id,escalation_type,escalation_level) VALUES (?,?,?,?,?)", (rule["rule_id"],emp["employee_id"],cycle["cycle_id"],rule["trigger_condition"],rule["escalation_level"]))
                    if rule["notify_employee"]:
                        db.execute("INSERT INTO notifications (recipient_id,notification_type,title,message) VALUES (?,?,?,?)",
                            (emp["employee_id"],"ESCALATION","Action Required",f"Escalation: {rule['rule_name']}"))
                    if rule["notify_manager"] and emp["manager_id"]:
                        db.execute("INSERT INTO notifications (recipient_id,notification_type,title,message) VALUES (?,?,?,?)",
                            (emp["manager_id"],"ESCALATION","Team Escalation",f"{emp['employee_name']}: {rule['rule_name']}"))
                    count += 1
    db.commit()
    db.close()
    return jsonify({"count": count})


@app.post("/api/escalation/resolve/<int:lid>")
@auth_required
@role_required("ADMIN")
def resolve_esc(lid):
    notes = request.json.get("notes", "")
    db = get_db()
    db.execute("UPDATE escalation_log SET status='RESOLVED',resolved_at=datetime('now'),resolved_by=?,notes=? WHERE log_id=?", (session["employee_id"],notes,lid))
    db.commit()
    db.close()
    return jsonify({"ok": True})


@app.post("/api/escalation/rules")
@auth_required
@role_required("ADMIN")
def add_rule():
    d = request.json
    db = get_db()
    db.execute("INSERT INTO escalation_rules (rule_name,trigger_condition,days_threshold,escalation_level,notify_employee,notify_manager,notify_skip_level,notify_hr) VALUES (?,?,?,?,?,?,?,?)",
        (d["rule_name"],d["trigger_condition"],int(d["days_threshold"]),int(d.get("escalation_level",1)),
         1 if d.get("notify_employee") else 0, 1 if d.get("notify_manager") else 0,
         1 if d.get("notify_skip_level") else 0, 1 if d.get("notify_hr") else 0))
    db.commit()
    db.close()
    return jsonify({"ok": True})


# ── AI FEATURES ──

GOAL_SUGGESTIONS = {
    "Revenue Growth": {
        "Sales": [
            {"title": "Achieve quarterly sales revenue target", "description": "Drive revenue growth by acquiring new clients and expanding existing accounts to meet quarterly sales targets", "uom_type": "NUMERIC_MIN", "target_hint": "Amount in ₹ (e.g., 5000000)"},
            {"title": "Increase new client acquisitions", "description": "Expand customer base by identifying and converting new business opportunities through targeted outreach", "uom_type": "NUMERIC_MIN", "target_hint": "Number of new clients (e.g., 15)"},
            {"title": "Grow upsell/cross-sell revenue by target %", "description": "Increase revenue from existing accounts through strategic upselling and cross-selling of products/services", "uom_type": "PERCENT_MIN", "target_hint": "Growth % (e.g., 20)"},
        ],
        "Engineering": [
            {"title": "Deliver product features that drive revenue", "description": "Build and ship high-impact product features aligned with sales pipeline needs and customer requests", "uom_type": "NUMERIC_MIN", "target_hint": "Number of revenue features shipped (e.g., 5)"},
            {"title": "Reduce customer churn through product stability", "description": "Improve product reliability to reduce churn rate and protect recurring revenue streams", "uom_type": "PERCENT_MAX", "target_hint": "Churn rate % (e.g., 3)"},
        ],
        "_default": [
            {"title": "Contribute to departmental revenue targets", "description": "Support revenue growth initiatives through cross-functional collaboration and process improvements", "uom_type": "NUMERIC_MIN", "target_hint": "Contribution amount or count"},
        ],
    },
    "Customer Satisfaction": {
        "Sales": [
            {"title": "Achieve target Net Promoter Score (NPS)", "description": "Maintain high customer satisfaction by ensuring quality service delivery and timely issue resolution", "uom_type": "NUMERIC_MIN", "target_hint": "NPS score (e.g., 85)"},
            {"title": "Reduce customer complaint resolution time", "description": "Resolve customer complaints within SLA timelines to improve satisfaction and retention rates", "uom_type": "NUMERIC_MAX", "target_hint": "Avg days to resolve (e.g., 3)"},
        ],
        "Engineering": [
            {"title": "Reduce production bug count per release", "description": "Improve code quality and testing practices to minimize customer-facing bugs in each release cycle", "uom_type": "NUMERIC_MAX", "target_hint": "Bugs per release (e.g., 5)"},
            {"title": "Achieve target system uptime percentage", "description": "Maintain system reliability and availability to ensure uninterrupted customer experience", "uom_type": "PERCENT_MIN", "target_hint": "Uptime % (e.g., 99.5)"},
        ],
        "HR": [
            {"title": "Achieve internal employee satisfaction score", "description": "Improve employee experience through engagement initiatives, surveys, and action on feedback", "uom_type": "PERCENT_MIN", "target_hint": "Satisfaction % (e.g., 85)"},
        ],
        "_default": [
            {"title": "Improve stakeholder satisfaction score", "description": "Enhance service quality for internal/external stakeholders through proactive communication and delivery", "uom_type": "PERCENT_MIN", "target_hint": "Satisfaction % (e.g., 90)"},
        ],
    },
    "Operational Excellence": {
        "Sales": [
            {"title": "Reduce average deal closure cycle time", "description": "Streamline the sales process to shorten time from lead to signed contract", "uom_type": "NUMERIC_MAX", "target_hint": "Days (e.g., 15)"},
            {"title": "Achieve sales forecast accuracy target", "description": "Improve pipeline management and forecasting accuracy for better resource planning", "uom_type": "PERCENT_MIN", "target_hint": "Accuracy % (e.g., 90)"},
        ],
        "Engineering": [
            {"title": "Reduce deployment lead time", "description": "Optimize CI/CD pipeline and release processes to enable faster and more reliable deployments", "uom_type": "NUMERIC_MAX", "target_hint": "Hours per deployment (e.g., 4)"},
            {"title": "Achieve sprint velocity consistency", "description": "Maintain consistent delivery velocity across sprints through better estimation and planning", "uom_type": "PERCENT_MIN", "target_hint": "Velocity variance within % (e.g., 85)"},
        ],
        "HR": [
            {"title": "Reduce time-to-hire for open positions", "description": "Streamline recruitment process to fill open positions faster without compromising quality", "uom_type": "NUMERIC_MAX", "target_hint": "Days to hire (e.g., 30)"},
        ],
        "_default": [
            {"title": "Improve process efficiency by target %", "description": "Identify and eliminate bottlenecks in key processes to improve overall operational efficiency", "uom_type": "PERCENT_MIN", "target_hint": "Improvement % (e.g., 15)"},
        ],
    },
    "People Development": {
        "_default": [
            {"title": "Complete professional development training hours", "description": "Invest in skill building through certifications, courses, and workshops aligned with career growth", "uom_type": "NUMERIC_MIN", "target_hint": "Training hours (e.g., 40)"},
            {"title": "Mentor junior team members", "description": "Conduct regular mentoring sessions to support junior colleagues' professional growth and skill development", "uom_type": "NUMERIC_MIN", "target_hint": "Mentoring sessions (e.g., 12)"},
            {"title": "Achieve team engagement score target", "description": "Foster a positive team environment through collaboration, recognition, and constructive feedback", "uom_type": "PERCENT_MIN", "target_hint": "Engagement score % (e.g., 80)"},
        ],
    },
    "Innovation & Digital": {
        "Engineering": [
            {"title": "Deliver innovation/PoC projects", "description": "Research and prototype new technologies or approaches that can improve products or internal processes", "uom_type": "NUMERIC_MIN", "target_hint": "PoCs delivered (e.g., 3)"},
            {"title": "Automate repetitive manual processes", "description": "Identify and automate manual workflows to save time and reduce errors across the team", "uom_type": "NUMERIC_MIN", "target_hint": "Processes automated (e.g., 5)"},
        ],
        "_default": [
            {"title": "Propose and implement process digitization initiatives", "description": "Identify manual or paper-based processes and propose digital solutions to improve efficiency", "uom_type": "NUMERIC_MIN", "target_hint": "Initiatives implemented (e.g., 2)"},
            {"title": "Adopt new tools/technologies for productivity", "description": "Evaluate and adopt new tools that improve team productivity, collaboration, or output quality", "uom_type": "NUMERIC_MIN", "target_hint": "Tools adopted (e.g., 2)"},
        ],
    },
    "Safety & Compliance": {
        "_default": [
            {"title": "Achieve zero safety incidents", "description": "Maintain a safe working environment with zero reportable safety incidents through proactive measures", "uom_type": "ZERO", "target_hint": "0 (zero incidents = success)"},
            {"title": "Complete all mandatory compliance trainings on time", "description": "Ensure 100% completion of required compliance and safety trainings within deadlines", "uom_type": "PERCENT_MIN", "target_hint": "Completion % (e.g., 100)"},
            {"title": "Pass all compliance audits without findings", "description": "Ensure department processes and documentation are audit-ready and pass compliance reviews cleanly", "uom_type": "ZERO", "target_hint": "0 (zero findings = success)"},
        ],
    },
    "Sustainability": {
        "_default": [
            {"title": "Reduce resource consumption by target %", "description": "Implement measures to reduce energy, paper, or material consumption in day-to-day operations", "uom_type": "PERCENT_MIN", "target_hint": "Reduction % (e.g., 10)"},
            {"title": "Participate in CSR/sustainability initiatives", "description": "Actively contribute to corporate sustainability programs and community engagement activities", "uom_type": "NUMERIC_MIN", "target_hint": "Initiatives participated (e.g., 4)"},
        ],
    },
    "Quality Improvement": {
        "Engineering": [
            {"title": "Achieve code review coverage target", "description": "Ensure all production code changes go through peer review to maintain code quality standards", "uom_type": "PERCENT_MIN", "target_hint": "Coverage % (e.g., 100)"},
            {"title": "Reduce defect leakage to production", "description": "Improve testing effectiveness to catch more defects before they reach production environments", "uom_type": "NUMERIC_MAX", "target_hint": "Defects leaked (e.g., 3)"},
        ],
        "_default": [
            {"title": "Reduce error/rework rate in deliverables", "description": "Improve first-time quality of work outputs to minimize rework and corrections", "uom_type": "PERCENT_MAX", "target_hint": "Rework rate % (e.g., 5)"},
            {"title": "Implement quality checkpoints in key processes", "description": "Introduce systematic quality checks at critical stages of workflow to prevent defects", "uom_type": "NUMERIC_MIN", "target_hint": "Checkpoints implemented (e.g., 3)"},
        ],
    },
}


@app.post("/api/ai/goal-suggestions")
@auth_required
def ai_goal_suggestions():
    d = request.json
    thrust_area = d.get("thrust_area", "")
    u = current_user()
    department = u["department"] if u else ""
    suggestions = GOAL_SUGGESTIONS.get(thrust_area, {})
    dept_suggestions = suggestions.get(department, suggestions.get("_default", []))
    return jsonify({"suggestions": dept_suggestions, "thrust_area": thrust_area, "department": department})


@app.get("/api/ai/checkin-summary/<int:sheet_id>")
@auth_required
@role_required("MANAGER", "ADMIN")
def ai_checkin_summary(sheet_id):
    quarter = request.args.get("quarter", "Q1")
    q = quarter.lower()
    db = get_db()
    sheet = db.execute("SELECT gs.*,e.employee_name,e.designation,e.department FROM goal_sheets gs JOIN employees e ON gs.employee_id=e.employee_id WHERE gs.sheet_id=?", (sheet_id,)).fetchone()
    if not sheet:
        db.close()
        return jsonify({"error": "Sheet not found"}), 404
    goals = db.execute("SELECT g.*,t.thrust_area_name FROM goals g LEFT JOIN thrust_areas t ON g.thrust_area_id=t.thrust_area_id WHERE g.sheet_id=? ORDER BY g.goal_id", (sheet_id,)).fetchall()
    comments = db.execute("SELECT * FROM checkin_comments WHERE sheet_id=? AND quarter=? ORDER BY created_at DESC", (sheet_id, quarter)).fetchall()
    db.close()

    total_goals = len(goals)
    if total_goals == 0:
        return jsonify({"summary": "No goals found for this employee.", "details": []})

    completed = sum(1 for g in goals if g[f"{q}_status"] == "COMPLETED")
    on_track = sum(1 for g in goals if g[f"{q}_status"] == "ON_TRACK")
    not_started = sum(1 for g in goals if g[f"{q}_status"] == "NOT_STARTED" or g[f"{q}_status"] is None)
    scores = [g[f"{q}_score"] for g in goals if g[f"{q}_score"] is not None]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0
    weighted_score = sum((g[f"{q}_score"] or 0) * g["weightage"] / 100 for g in goals)
    weighted_score = round(weighted_score, 1)

    at_risk = []
    top_performers = []
    details = []
    for g in goals:
        score = g[f"{q}_score"]
        status = g[f"{q}_status"] or "NOT_STARTED"
        actual = g[f"{q}_actual"] or "Not entered"
        detail = {
            "goal": g["goal_title"], "thrust_area": g["thrust_area_name"] or "N/A",
            "target": g["target_value"], "actual": actual,
            "status": status, "score": score, "weightage": g["weightage"],
        }
        if score is not None and score < 50:
            at_risk.append(g["goal_title"])
            detail["flag"] = "AT_RISK"
        elif score is not None and score >= 90:
            top_performers.append(g["goal_title"])
            detail["flag"] = "EXCELLENT"
        details.append(detail)

    lines = [f"**{sheet['employee_name']}** ({sheet['designation']}, {sheet['department']}) — {quarter} Summary:"]
    lines.append(f"")
    lines.append(f"Overall weighted score: **{weighted_score}%** (avg: {avg_score}%)")
    lines.append(f"Goals: {completed} completed, {on_track} on track, {not_started} not started (out of {total_goals})")
    if at_risk:
        lines.append(f"")
        lines.append(f"⚠️ **At-risk goals** (below 50%): {', '.join(at_risk)}")
    if top_performers:
        lines.append(f"")
        lines.append(f"🌟 **Top performers** (90%+): {', '.join(top_performers)}")
    if not scores:
        lines.append(f"")
        lines.append(f"📝 Note: No actuals entered yet for {quarter}. Remind employee to log achievements.")

    recommendations = []
    if not_started > 0:
        recommendations.append(f"Follow up on {not_started} goal(s) still not started")
    if at_risk:
        recommendations.append(f"Discuss blockers for at-risk goals: {', '.join(at_risk)}")
    if weighted_score >= 80:
        recommendations.append("Recognize strong performance and discuss stretch targets")
    elif weighted_score >= 50:
        recommendations.append("Explore support needed to improve from good to great")
    elif scores:
        recommendations.append("Deep-dive into challenges and create an action plan for improvement")
    if len(comments) == 0:
        recommendations.append(f"No prior check-in comments for {quarter} — this is the first review")

    return jsonify({
        "summary": "\n".join(lines),
        "details": details,
        "stats": {
            "total_goals": total_goals, "completed": completed, "on_track": on_track,
            "not_started": not_started, "avg_score": avg_score, "weighted_score": weighted_score,
        },
        "at_risk": at_risk,
        "top_performers": top_performers,
        "recommendations": recommendations,
        "prior_comments": len(comments),
    })


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_react(path):
    if path and os.path.exists(os.path.join(STATIC_FOLDER, path)):
        return send_from_directory(STATIC_FOLDER, path)
    return send_from_directory(STATIC_FOLDER, "index.html")


if __name__ == "__main__":
    init_db()
    seed_data()
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host="0.0.0.0", port=port)
