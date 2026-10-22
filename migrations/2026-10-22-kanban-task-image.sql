-- Add reference image support to Kanban tasks
-- Allows users to attach one image per task for planning/idea reference

-- Add columns (nullable for backward compatibility)
alter table kanban_tasks 
  add column if not exists image_url text,
  add column if not exists image_path text;

-- Index for faster lookups by profile
create index if not exists kanban_tasks_image_idx on kanban_tasks(profile_id) where image_url is not null;

-- Add comment to document the purpose
comment on column kanban_tasks.image_url is 'URL/path to the image file stored for task reference';
comment on column kanban_tasks.image_path is 'Server path to the image for reference purposes (planning/ideas)';