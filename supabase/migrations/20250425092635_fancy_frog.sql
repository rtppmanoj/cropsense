/*
  # Create SMS logs table

  1. New Tables
    - `sms_logs`
      - `id` (uuid, primary key)
      - `created_at` (timestamp with timezone)
      - `phone_number` (text)
      - `message` (text)
      - `status` (text)
      - `twilio_sid` (text)

  2. Security
    - Enable RLS on `sms_logs` table
    - Add policy for service role to insert records
*/

CREATE TABLE IF NOT EXISTS sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  phone_number text NOT NULL,
  message text NOT NULL,
  status text NOT NULL,
  twilio_sid text NOT NULL
);

ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert SMS logs"
  ON sms_logs
  FOR INSERT
  TO service_role
  USING (true);

CREATE POLICY "Service role can read SMS logs"
  ON sms_logs
  FOR SELECT
  TO service_role
  USING (true);