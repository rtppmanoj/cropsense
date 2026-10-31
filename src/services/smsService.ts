export const sendSmsRecommendation = async (
  phoneNumber: string,
  recommendations: string[],
  location: string
) => {
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-sms`;
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phoneNumber,
      recommendations,
      location,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send SMS');
  }

  return response.json();
};