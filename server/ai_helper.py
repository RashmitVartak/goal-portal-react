import os
import google.generativeai as genai
import threading

GEMINI_KEYS = [
    os.environ.get("GEMINI_KEY_1", ""),
    os.environ.get("GEMINI_KEY_2", ""),
    os.environ.get("GEMINI_KEY_3", ""),
]
GEMINI_KEYS = [k for k in GEMINI_KEYS if k]

_lock = threading.Lock()
_index = 0


def get_next_key():
    global _index
    with _lock:
        key = GEMINI_KEYS[_index % len(GEMINI_KEYS)]
        _index += 1
    return key


def ask_gemini(prompt, max_tokens=1024):
    key = get_next_key()
    genai.configure(api_key=key)
    model = genai.GenerativeModel("gemini-2.0-flash")
    try:
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=max_tokens,
                temperature=0.7,
            ),
        )
        return response.text
    except Exception as e:
        return f"AI Error: {str(e)}"


def ai_generate_goal(description, department, designation, thrust_area):
    prompt = f"""You are an HR goal-setting expert. An employee wants to create a professional SMART goal.

Employee Details:
- Department: {department}
- Designation: {designation}
- Thrust Area: {thrust_area}
- What they want to achieve: {description}

Generate a structured goal with these fields in EXACTLY this format (no markdown, no extra text):
TITLE: [A clear, concise goal title - max 80 chars]
DESCRIPTION: [2-3 sentence professional description explaining the goal, how it will be measured, and its business impact]
UOM_TYPE: [One of: NUMERIC_MIN, NUMERIC_MAX, PERCENT_MIN, PERCENT_MAX, TIMELINE, ZERO]
TARGET_HINT: [Suggested target value with unit, e.g. "5000000 (₹50 Lakhs)" or "95 (95%)" or "0 (zero incidents)"]
WEIGHTAGE_HINT: [Suggested weightage between 10-40, just the number]

UOM Type Guide:
- NUMERIC_MIN = Higher is better (revenue, count)
- NUMERIC_MAX = Lower is better (cost, time, errors)
- PERCENT_MIN = Higher % is better (satisfaction, accuracy)
- PERCENT_MAX = Lower % is better (churn, defect rate)
- TIMELINE = Date-based completion
- ZERO = Zero is success (incidents, complaints)"""

    text = ask_gemini(prompt)
    result = {"raw": text}
    for line in text.strip().split("\n"):
        line = line.strip()
        if line.startswith("TITLE:"):
            result["title"] = line[6:].strip()
        elif line.startswith("DESCRIPTION:"):
            result["description"] = line[12:].strip()
        elif line.startswith("UOM_TYPE:"):
            val = line[9:].strip()
            if val in ("NUMERIC_MIN", "NUMERIC_MAX", "PERCENT_MIN", "PERCENT_MAX", "TIMELINE", "ZERO"):
                result["uom_type"] = val
        elif line.startswith("TARGET_HINT:"):
            result["target_hint"] = line[12:].strip()
        elif line.startswith("WEIGHTAGE_HINT:"):
            result["weightage_hint"] = line[15:].strip()
    return result


def ai_summarize_report(report_data, query, role, department):
    goals_text = ""
    for r in report_data[:50]:
        goals_text += f"- {r['employee_name']} ({r['department']}): {r['goal_title']} | Target: {r['target_value']} | Q1: {r.get('q1_actual','N/A')} ({r.get('q1_score','N/A')}%) | Q2: {r.get('q2_actual','N/A')} ({r.get('q2_score','N/A')}%) | Q3: {r.get('q3_actual','N/A')} ({r.get('q3_score','N/A')}%) | Q4: {r.get('q4_actual','N/A')} ({r.get('q4_score','N/A')}%)\n"

    prompt = f"""You are an HR analytics expert. Analyze this goal achievement data and answer the user's question.

User Role: {role}
User Department: {department}
User Question: {query}

Goal Achievement Data:
{goals_text}

Provide a clear, concise summary with:
1. Direct answer to the question
2. Key insights (top performers, at-risk areas)
3. Specific numbers and percentages
4. Actionable recommendations

Keep response under 300 words. Use bullet points for clarity. Do not use markdown headers."""

    return ask_gemini(prompt, max_tokens=800)
