import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config(); 

// Initialize Supabase client with the service role key
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Example insert operation
const { data, insertError } = await supabase
  .from('wallets')
  .insert([{ user_id: '3d631181-b518-4b47-a5e5-73c5a7650129', email: 'earthchie@gmail.com', wallet: '0x5c4CF997239C6E6ac1EdEAB25Cb900FD06B8E265' }]);
  console.log('meh', data, insertError);
if (insertError) {
  console.error('Error inserting data:', insertError);
} else {
  console.log('Data inserted successfully:', insertError);
}