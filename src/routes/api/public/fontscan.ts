import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/fontscan')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const form = await request.formData();
          const image = form.get('image');
          if (!(image instanceof File)) {
            return Response.json({ error: 'Missing image file' }, { status: 400 });
          }

          const bytes = new Uint8Array(await image.arrayBuffer());
          const base64 = btoa(String.fromCharCode(...bytes));
          const mediaType = image.type || 'image/jpeg';
          const apiKey = process.env.LOVABLE_API_KEY;
          if (!apiKey) throw new Error('LOVABLE_API_KEY is not configured');

          const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-3-flash-preview',
              messages: [
                {
                  role: 'system',
                  content: 'Extract only the visible text from the image for font search. Return plain text only.',
                },
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: 'Read the text in this image.' },
                    { type: 'image_url', image_url: { url: `data:${mediaType};base64,${base64}` } },
                  ],
                },
              ],
            }),
          });

          if (!aiResponse.ok) {
            const errorText = await aiResponse.text();
            console.error('FontScan Cloud API error', aiResponse.status, errorText);
            return Response.json({ error: 'FontScan Cloud API failed' }, { status: 502 });
          }

          const data = await aiResponse.json();
          const text = String(data.choices?.[0]?.message?.content ?? '').trim();
          return Response.json({ text });
        } catch (error) {
          console.error('FontScan route failed', error);
          return Response.json({ error: 'FontScan route failed' }, { status: 500 });
        }
      },
    },
  },
});
