import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hrnyymqkpqzlemnqcsll.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhybnl5bXFrcHF6bGVtbnFjc2xsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2Njk3ODUsImV4cCI6MjA5MDI0NTc4NX0.UW70x9HXtzReeaKJ0-xT8T-FRLjztSIFCwyWZvqWR0w';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: { params: { eventsPerSecond: 10 } },
});
