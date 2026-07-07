
REVOKE EXECUTE ON FUNCTION public.create_attendances_for_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_attendances_for_new_player() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_trainer() FROM PUBLIC, anon, authenticated;
