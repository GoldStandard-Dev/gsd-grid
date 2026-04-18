alter table public.pricing_collections
  add column if not exists item_field_schema jsonb not null default '[]'::jsonb,
  add column if not exists item_tag_options jsonb not null default '[]'::jsonb,
  add column if not exists group_rules jsonb not null default '[]'::jsonb;

alter table public.pricing_fabrics
  add column if not exists field_values jsonb not null default '{}'::jsonb,
  add column if not exists tags jsonb not null default '[]'::jsonb,
  add column if not exists pricing_link jsonb not null default '{}'::jsonb;
