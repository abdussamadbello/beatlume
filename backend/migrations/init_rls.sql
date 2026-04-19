ALTER DATABASE beatlume SET app.current_org_id = '00000000-0000-0000-0000-000000000000';
CREATE OR REPLACE FUNCTION current_org_id() RETURNS uuid AS $$
  SELECT current_setting('app.current_org_id', true)::uuid;
$$ LANGUAGE SQL STABLE;
