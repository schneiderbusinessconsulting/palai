-- Seed support agents: Rafael (L2) and Philipp (L1)
INSERT INTO support_agents (name, email, role, is_active)
VALUES
  ('Rafael', 'rafael@palacios-relations.ch', 'L2', true),
  ('Philipp', 'philipp@palacios-relations.ch', 'L1', true)
ON CONFLICT (email) DO UPDATE SET
  role = EXCLUDED.role,
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;
