-- Fix 12 — make a material "return" disposition atomic.
-- The material cost update and the disposition flag must both land together so a
-- double-tap or partial failure can never leave inconsistent state. SECURITY
-- INVOKER keeps RLS in force, so a user can only dispose their own materials.

CREATE OR REPLACE FUNCTION dispose_material_return(
  p_material_id uuid,
  p_return_qty  numeric
)
RETURNS TABLE (quantity_used numeric, actual_total_cost numeric)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_ordered  numeric;
  v_unit     numeric;
  v_status   text;
  v_new_used numeric;
  v_new_cost numeric;
BEGIN
  -- Lock the row so concurrent taps serialize.
  SELECT m.quantity_ordered, m.unit_cost, m.disposition_status
    INTO v_ordered, v_unit, v_status
  FROM materials m
  WHERE m.id = p_material_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  IF v_status IS NOT NULL THEN
    RAISE EXCEPTION 'already_disposed';
  END IF;

  v_new_used := GREATEST(0, COALESCE(v_ordered, 0) - p_return_qty);
  v_new_cost := CASE WHEN v_unit IS NOT NULL THEN v_new_used * v_unit ELSE NULL END;

  UPDATE materials
     SET quantity_used       = v_new_used,
         disposition_status  = 'returned',
         disposition_qty     = p_return_qty,
         actual_total_cost   = COALESCE(v_new_cost, actual_total_cost),
         actual_quantity     = v_new_used
   WHERE id = p_material_id;

  RETURN QUERY SELECT v_new_used, v_new_cost;
END;
$$;
