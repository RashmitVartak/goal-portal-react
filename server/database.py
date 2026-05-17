import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "goal_portal.db")

##
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db()
    c = conn.cursor()
    c.executescript("""
    CREATE TABLE IF NOT EXISTS cycles (
        cycle_id INTEGER PRIMARY KEY AUTOINCREMENT, cycle_name TEXT NOT NULL, cycle_year INTEGER NOT NULL,
        goal_setting_start TEXT, goal_setting_end TEXT,
        q1_start TEXT, q1_end TEXT, q2_start TEXT, q2_end TEXT,
        q3_start TEXT, q3_end TEXT, q4_start TEXT, q4_end TEXT,
        is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS employees (
        employee_id TEXT PRIMARY KEY, employee_name TEXT NOT NULL, email TEXT, department TEXT,
        designation TEXT, role TEXT NOT NULL DEFAULT 'EMPLOYEE', manager_id TEXT,
        password TEXT NOT NULL DEFAULT 'password123', is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS thrust_areas (
        thrust_area_id INTEGER PRIMARY KEY AUTOINCREMENT, thrust_area_name TEXT NOT NULL,
        description TEXT, is_active INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS goal_sheets (
        sheet_id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id TEXT NOT NULL, cycle_id INTEGER NOT NULL,
        status TEXT DEFAULT 'DRAFT', submitted_at TEXT, approved_at TEXT, approved_by TEXT,
        is_locked INTEGER DEFAULT 0, rejection_reason TEXT,
        created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
        FOREIGN KEY (cycle_id) REFERENCES cycles(cycle_id)
    );
    CREATE TABLE IF NOT EXISTS goals (
        goal_id INTEGER PRIMARY KEY AUTOINCREMENT, sheet_id INTEGER NOT NULL, thrust_area_id INTEGER,
        goal_title TEXT NOT NULL, goal_description TEXT, uom_type TEXT NOT NULL,
        target_value TEXT, target_deadline TEXT, weightage REAL NOT NULL,
        is_shared INTEGER DEFAULT 0, shared_goal_id INTEGER, is_primary_owner INTEGER DEFAULT 1,
        q1_actual TEXT, q1_status TEXT DEFAULT 'NOT_STARTED', q1_score REAL,
        q2_actual TEXT, q2_status TEXT DEFAULT 'NOT_STARTED', q2_score REAL,
        q3_actual TEXT, q3_status TEXT DEFAULT 'NOT_STARTED', q3_score REAL,
        q4_actual TEXT, q4_status TEXT DEFAULT 'NOT_STARTED', q4_score REAL,
        final_score REAL, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (sheet_id) REFERENCES goal_sheets(sheet_id)
    );
    CREATE TABLE IF NOT EXISTS shared_goals (
        shared_goal_id INTEGER PRIMARY KEY AUTOINCREMENT, source_goal_title TEXT NOT NULL,
        source_goal_description TEXT, thrust_area_id INTEGER, uom_type TEXT NOT NULL,
        target_value TEXT, created_by TEXT NOT NULL, department TEXT,
        is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS checkin_comments (
        comment_id INTEGER PRIMARY KEY AUTOINCREMENT, sheet_id INTEGER NOT NULL, quarter TEXT NOT NULL,
        manager_id TEXT NOT NULL, comment_text TEXT, created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS audit_trail (
        audit_id INTEGER PRIMARY KEY AUTOINCREMENT, entity_type TEXT NOT NULL, entity_id INTEGER NOT NULL,
        action TEXT NOT NULL, field_changed TEXT, old_value TEXT, new_value TEXT,
        changed_by TEXT NOT NULL, change_reason TEXT, created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS notifications (
        notification_id INTEGER PRIMARY KEY AUTOINCREMENT, recipient_id TEXT NOT NULL,
        notification_type TEXT NOT NULL, title TEXT, message TEXT, is_read INTEGER DEFAULT 0,
        related_entity_type TEXT, related_entity_id INTEGER, created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS escalation_rules (
        rule_id INTEGER PRIMARY KEY AUTOINCREMENT, rule_name TEXT NOT NULL,
        trigger_condition TEXT NOT NULL, days_threshold INTEGER NOT NULL,
        escalation_level INTEGER DEFAULT 1, notify_employee INTEGER DEFAULT 1,
        notify_manager INTEGER DEFAULT 1, notify_skip_level INTEGER DEFAULT 0,
        notify_hr INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS escalation_log (
        log_id INTEGER PRIMARY KEY AUTOINCREMENT, rule_id INTEGER NOT NULL, employee_id TEXT NOT NULL,
        cycle_id INTEGER NOT NULL, escalation_type TEXT, escalation_level INTEGER,
        status TEXT DEFAULT 'OPEN', resolved_at TEXT, resolved_by TEXT, notes TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );
    """)
    conn.commit()
    conn.close()


def seed_data():
    conn = get_db()
    c = conn.cursor()
    if c.execute("SELECT COUNT(*) FROM cycles").fetchone()[0] == 0:
        c.execute("INSERT INTO cycles (cycle_name,cycle_year,goal_setting_start,goal_setting_end,q1_start,q1_end,q2_start,q2_end,q3_start,q3_end,q4_start,q4_end,is_active) VALUES ('FY 2026-27',2026,'2026-05-01','2026-06-30','2026-07-01','2026-07-31','2026-10-01','2026-10-31','2027-01-01','2027-01-31','2027-03-01','2027-04-30',1)")
    if c.execute("SELECT COUNT(*) FROM employees").fetchone()[0] == 0:
        c.executemany("INSERT INTO employees (employee_id,employee_name,email,department,designation,role,manager_id,password) VALUES (?,?,?,?,?,?,?,?)", [
            ('EMP001','Rajesh Kumar','rajesh@company.com','Corporate','VP & Head','ADMIN',None,'admin123'),
            ('EMP002','Priya Sharma','priya@company.com','Sales','Sales Manager','MANAGER','EMP001','manager123'),
            ('EMP003','Amit Patel','amit@company.com','Sales','Sales Executive','EMPLOYEE','EMP002','emp123'),
            ('EMP004','Sneha Reddy','sneha@company.com','Sales','Sales Executive','EMPLOYEE','EMP002','emp123'),
            ('EMP005','Ravi Kulkarni','ravi@company.com','Sales','Sales Executive','EMPLOYEE','EMP002','emp123'),
            ('EMP006','Meera Joshi','meera@company.com','Sales','Sales Executive','EMPLOYEE','EMP002','emp123'),
            ('EMP007','Vikram Singh','vikram@company.com','Engineering','Engineering Manager','MANAGER','EMP001','manager123'),
            ('EMP008','Deepa Nair','deepa@company.com','Engineering','Software Engineer','EMPLOYEE','EMP007','emp123'),
            ('EMP009','Arjun Mehta','arjun@company.com','Engineering','Software Engineer','EMPLOYEE','EMP007','emp123'),
            ('EMP010','Pooja Desai','pooja@company.com','Engineering','Software Engineer','EMPLOYEE','EMP007','emp123'),
            ('EMP011','Sanjay Rao','sanjay@company.com','Engineering','QA Engineer','EMPLOYEE','EMP007','emp123'),
            ('EMP012','Nisha Verma','nisha@company.com','Engineering','DevOps Engineer','EMPLOYEE','EMP007','emp123'),
            ('EMP013','Kavitha Iyer','kavitha@company.com','HR','HR Manager','MANAGER','EMP001','manager123'),
            ('EMP014','Rohit Joshi','rohit@company.com','HR','HR Executive','EMPLOYEE','EMP013','emp123'),
            ('EMP015','Ananya Pillai','ananya@company.com','HR','HR Executive','EMPLOYEE','EMP013','emp123'),
        ])
    if c.execute("SELECT COUNT(*) FROM thrust_areas").fetchone()[0] == 0:
        c.executemany("INSERT INTO thrust_areas (thrust_area_name,description) VALUES (?,?)", [
            ('Revenue Growth','Increase revenue and sales performance'),
            ('Customer Satisfaction','Improve customer experience and retention'),
            ('Operational Excellence','Process improvement and cost optimization'),
            ('People Development','Talent development and team building'),
            ('Innovation & Digital','Digital transformation and technology adoption'),
            ('Safety & Compliance','Regulatory compliance and risk management'),
            ('Sustainability','Environmental sustainability and CSR'),
            ('Quality Improvement','Enhance product/service quality'),
        ])
    if c.execute("SELECT COUNT(*) FROM escalation_rules").fetchone()[0] == 0:
        c.executemany("INSERT INTO escalation_rules (rule_name,trigger_condition,days_threshold,escalation_level,notify_employee,notify_manager,notify_skip_level,notify_hr) VALUES (?,?,?,?,?,?,?,?)", [
            ('Goal Not Submitted','GOAL_NOT_SUBMITTED',7,1,1,1,0,0),
            ('Goal Not Submitted - Escalated','GOAL_NOT_SUBMITTED',14,2,1,1,1,1),
            ('Goal Not Approved','GOAL_NOT_APPROVED',5,1,0,1,0,0),
            ('Goal Not Approved - Escalated','GOAL_NOT_APPROVED',10,2,0,1,1,1),
            ('Checkin Not Completed','CHECKIN_NOT_COMPLETED',7,1,1,1,0,0),
            ('Checkin Not Completed - Escalated','CHECKIN_NOT_COMPLETED',14,2,1,1,1,1),
        ])
    conn.commit()
    conn.close()
