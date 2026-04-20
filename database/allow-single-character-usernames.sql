alter table usernames drop constraint if exists usernames_format_chk;

alter table usernames
add constraint usernames_format_chk
check (
  username = lower(username)
  and username ~ '^(?=.{1,30}$)(?!.*[_-]{2})[a-z0-9_-]+$'
);
