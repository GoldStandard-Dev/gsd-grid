-- Expand white-label branding controls for organization settings.
alter table public.organization_settings
  add column if not exists brand_logo_url text,
  add column if not exists brand_primary_color text not null default '#111111',
  add column if not exists brand_primary_hover_color text not null default '#B8962E',
  add column if not exists brand_primary_text_color text not null default '#FFFFFF',
  add column if not exists brand_secondary_color text not null default '#FFFCF6',
  add column if not exists brand_secondary_text_color text not null default '#111111',
  add column if not exists brand_accent_color text not null default '#D4AF37',
  add column if not exists brand_background_color text not null default '#F9FAFB',
  add column if not exists brand_surface_color text not null default '#FFFFFF',
  add column if not exists brand_border_color text not null default '#E5E7EB',
  add column if not exists brand_success_color text not null default '#166534',
  add column if not exists brand_warning_color text not null default '#B45309',
  add column if not exists brand_error_color text not null default '#B42318',
  add column if not exists brand_typography text not null default 'Sans',
  add column if not exists brand_heading_size numeric(5,2) not null default 28,
  add column if not exists brand_body_size numeric(5,2) not null default 14,
  add column if not exists brand_font_weight text not null default 'Bold',
  add column if not exists brand_header_layout text not null default 'Left logo / right info',
  add column if not exists brand_button_style text not null default 'Rounded',
  add column if not exists brand_button_variant text not null default 'Fill',
  add column if not exists brand_button_shadow boolean not null default false,
  add column if not exists brand_card_style text not null default 'Bordered',
  add column if not exists brand_input_style text not null default 'Rounded outline',
  add column if not exists brand_show_logo boolean not null default true,
  add column if not exists brand_show_company_name boolean not null default true,
  add column if not exists brand_show_document_number_badge boolean not null default true,
  add column if not exists brand_show_divider boolean not null default true,
  add column if not exists document_density text not null default 'Compact',
  add column if not exists document_detail_level text not null default 'Detailed',
  add column if not exists document_grid_lines boolean not null default true,
  add column if not exists document_show_measurements boolean not null default true,
  add column if not exists document_show_notes boolean not null default true,
  add column if not exists document_show_installation boolean not null default true,
  add column if not exists document_show_deposit boolean not null default true,
  add column if not exists document_show_signature boolean not null default true,
  add column if not exists document_show_line_item_descriptions boolean not null default true;

alter table public.organization_settings
  drop constraint if exists organization_settings_brand_theme_check;

alter table public.organization_settings
  add constraint organization_settings_brand_theme_check
  check (brand_theme in ('Gold + White', 'Minimal White', 'Classic Gold', 'Premium', 'Bold', 'Utility'));
