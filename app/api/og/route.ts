// app/api/og/route.ts
import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import React from 'react';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const text = searchParams.get('text') || 'Modelflick';

    // Using React.createElement to avoid JSX parsing issues
    const element = React.createElement(
      'div',
      {
        style: {
          backgroundColor: 'black',
          height: '100%',
          width: '100%',
          display: 'flex',
          textAlign: 'center',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
        },
      },
      [
        React.createElement(
          'div',
          {
            key: 'title',
            style: {
              display: 'flex',
              fontSize: 60,
              color: 'white',
              marginTop: 30,
              lineHeight: 1.8,
            },
          },
          text
        ),
        React.createElement(
          'div',
          {
            key: 'subtitle',
            style: {
              display: 'flex',
              fontSize: 24,
              color: 'white',
              marginTop: 30,
            },
          },
          'by modelflick'
        ),
      ]
    );

    return new ImageResponse(element, {
      width: 1200,
      height: 630,
      headers: {
        'Content-Type': 'image/png',
      },
    });
  } catch (e: unknown) {
    if (e instanceof Error) {
      console.error(e.message);
    } else {
      console.error('Unknown error', e);
    }
    return new Response('Failed to generate the image', { status: 500 });
  }
}
