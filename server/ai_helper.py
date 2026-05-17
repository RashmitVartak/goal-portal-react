import os
import re
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
        if not GEMINI_KEYS:
            return None
        key = GEMINI_KEYS[_index % len(GEMINI_KEYS)]
        _index += 1
    return key


def ask_gemini(prompt, max_tokens=1024):
    key = get_next_key()
    if not key:
        return "AI Error: No API keys configured. Check .env file."
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


def parse_field(text, field_name):
    pattern = rf'\*?\*?{field_name}\s*:\*?\*?\s*(.*?)(?:\n|$)'
    match = re.search(pattern, text, re.IGNORECASE)
    if match:
        return match.group(1).strip().strip('*').strip()
    return None


def ai_generate_goal(description, department, designation, thrust_area):
    prompt = f"""You are an HR goal-setting expert. Generate a SMART goal based on this input.

Employee: {designation} in {department} department
Thrust Area: {thrust_area}
What they want: {description}

Reply in EXACTLY this plain text format with NO markdown, NO bold, NO asterisks:

TITLE: A clear goal title in under 80 characters
DESCRIPTION: 2-3 sentences about the goal, measurement method, and business impact
UOM_TYPE: NUMERIC_MIN
TARGET_HINT: 100 (suggested target with unit)
WEIGHTAGE_HINT: 20

For UOM_TYPE use ONLY one of: NUMERIC_MIN, NUMERIC_MAX, PERCENT_MIN, PERCENT_MAX, TIMELINE, ZERO
- NUMERIC_MIN means higher is better (revenue, calls, count)
- NUMERIC_MAX means lower is better (cost, errors, time)
- PERCENT_MIN means higher percentage is better
- PERCENT_MAX means lower percentage is better
- TIMELINE means date-based
- ZERO means zero is success (incidents)

Do NOT use any markdown formatting. Just plain FIELD: value lines."""

    text = ask_gemini(prompt)
    result = {"raw": text}

    if text.startswith("AI Error"):
        result["error"] = text
        return result

    title = parse_field(text, "TITLE")
    description_val = parse_field(text, "DESCRIPTION")
    uom = parse_field(text, "UOM_TYPE")
    target = parse_field(text, "TARGET_HINT")
    weightage = parse_field(text, "WEIGHTAGE_HINT")

    if title:
        result["title"] = title
    if description_val:
        result["description"] = description_val
    if uom:
        uom_clean = uom.upper().strip()
        valid = ["NUMERIC_MIN", "NUMERIC_MAX", "PERCENT_MIN", "PERCENT_MAX", "TIMELINE", "ZERO"]
        for v in valid:
            if v in uom_clean:
                result["uom_type"] = v
                break
    if target:
        result["target_hint"] = target
    if weightage:
        nums = re.findall(r'\d+', weightage)
        result["weightage_hint"] = nums[0] if nums else weightage

    return result


def ai_summarize_report(report_data, query, role, department):
    goals_text = ""
    for r in report_data[:50]:
        goals_text += f"- {r['employee_name']} ({r['department']}): {r['goal_title']} | Target: {r.get('target_value','N/A')} | Q1: {r.get('q1_actual','N/A')} ({r.get('q1_score','N/A')}%) | Q2: {r.get('q2_actual','N/A')} ({r.get('q2_score','N/A')}%) | Q3: {r.get('q3_actual','N/A')} ({r.get('q3_score','N/A')}%) | Q4: {r.get('q4_actual','N/A')} ({r.get('q4_score','N/A')}%)\n"

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

Keep response under 300 words. Use bullet points. No markdown headers. No asterisks for bold."""

    return ask_gemini(prompt, max_tokens=800)
