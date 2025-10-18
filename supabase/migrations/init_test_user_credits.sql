-- Initialize credits for specific user (1299078636@qq.com)
-- First, find the user_id by email, then insert or update credits

-- Option 1: If you want to insert credits for a user (use this if credits don't exist yet)
INSERT INTO public.user_credits (user_id, total_credits, used_credits, remaining_credits)
SELECT id, 1, 0, 1
FROM auth.users
WHERE email = '1299078636@qq.com'
ON CONFLICT (user_id)
DO UPDATE SET
  total_credits = 1,
  used_credits = 0,
  remaining_credits = 1,
  updated_at = NOW();

-- Option 2: If you just want to update existing credits
-- UPDATE public.user_credits
-- SET total_credits = 1, used_credits = 0, remaining_credits = 1, updated_at = NOW()
-- WHERE user_id = (SELECT id FROM auth.users WHERE email = '1299078636@qq.com');
