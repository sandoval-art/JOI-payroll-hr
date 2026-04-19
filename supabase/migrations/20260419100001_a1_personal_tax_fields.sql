-- A1: Add personal & tax info fields to employee profiles
-- All nullable — existing rows won't have these populated yet.
-- Format validation is handled in the UI layer for friendly error messages.

alter table public.employees
  add column if not exists curp       text,
  add column if not exists rfc        text,
  add column if not exists address    text,
  add column if not exists phone      text,
  add column if not exists bank_clabe text;
