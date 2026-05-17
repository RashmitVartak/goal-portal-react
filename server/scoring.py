def compute_score(uom_type, target_value, actual_value):
    if actual_value is None or actual_value == "" or target_value is None or target_value == "":
        return None
    try:
        if uom_type == "ZERO":
            return 100.0 if float(actual_value) == 0 else 0.0
        target = float(target_value)
        actual = float(actual_value)
        if target == 0:
            return 0.0
        if uom_type in ("NUMERIC_MIN", "PERCENT_MIN"):
            return min(round((actual / target) * 100, 2), 100.0)
        if uom_type in ("NUMERIC_MAX", "PERCENT_MAX"):
            if actual == 0:
                return 100.0
            return min(round((target / actual) * 100, 2), 100.0)
        if uom_type == "TIMELINE":
            return 100.0 if actual <= target else 0.0
    except (ValueError, ZeroDivisionError):
        return None
    return None
