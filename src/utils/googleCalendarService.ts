/**
 * Google Calendar Integration Service for MTFeed
 * Handles OAuth2 client-side token acquisition and Calendar events creation/update/deletion.
 */

declare global {
  interface Window {
    google?: any;
  }
}

import firebaseConfig from '../../firebase-applet-config.json';

const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const TOKEN_STORAGE_KEY = 'mtfeed_gcal_access_token';
const TOKEN_EXPIRY_KEY = 'mtfeed_gcal_token_expiry';

// Accurate OAuth Client ID from project configuration
export const GOOGLE_OAUTH_CLIENT_ID = firebaseConfig.oAuthClientId || '337243988720-ol8rsjeo9vvu933v842qjrgunl9g1f3p.apps.googleusercontent.com';

// Cache for access token
let cachedAccessToken: string | null = null;

export function getStoredAccessToken(): string | null {
  if (cachedAccessToken) return cachedAccessToken;
  try {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (token && expiry && Number(expiry) > Date.now()) {
      cachedAccessToken = token;
      return token;
    }
  } catch {}
  return null;
}

export function saveAccessToken(token: string, expiresInSeconds: number = 3600) {
  cachedAccessToken = token;
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + (expiresInSeconds - 60) * 1000));
  } catch {}
}

export function clearAccessToken() {
  cachedAccessToken = null;
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  } catch {}
}

/**
 * Request OAuth Access Token from GIS
 */
export async function requestGoogleCalendarAuth(clientId?: string): Promise<string> {
  const existing = getStoredAccessToken();
  if (existing) return existing;

  return new Promise((resolve, reject) => {
    let hasResolved = false;

    // Safety timeout: If user closes popup or ignores it, reject after 6 seconds so UI doesn't hang
    const timer = setTimeout(() => {
      if (!hasResolved) {
        hasResolved = true;
        reject(new Error('Google Auth request timed out or was closed'));
      }
    }, 6000);

    if (typeof window === 'undefined' || !window.google?.accounts?.oauth2) {
      setTimeout(() => {
        if (!window.google?.accounts?.oauth2) {
          if (!hasResolved) {
            hasResolved = true;
            clearTimeout(timer);
            reject(new Error('Google Identity Services SDK is not loaded yet.'));
          }
          return;
        }
        initAndRequest();
      }, 500);
      return;
    }

    initAndRequest();

    function initAndRequest() {
      try {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId || GOOGLE_OAUTH_CLIENT_ID,
          scope: GOOGLE_CALENDAR_SCOPE,
          callback: (response: any) => {
            if (hasResolved) return;
            hasResolved = true;
            clearTimeout(timer);

            if (response.error) {
              console.warn('Google Auth Error:', response);
              reject(new Error(response.error_description || response.error));
              return;
            }
            if (response.access_token) {
              const expiresIn = response.expires_in ? Number(response.expires_in) : 3600;
              saveAccessToken(response.access_token, expiresIn);
              resolve(response.access_token);
            } else {
              reject(new Error('No access token received from Google.'));
            }
          }
        });

        client.requestAccessToken({ prompt: '' });
      } catch (err) {
        if (!hasResolved) {
          hasResolved = true;
          clearTimeout(timer);
          reject(err);
        }
      }
    }
  });
}

/**
 * Generate Google Calendar Web URL for 1-click addition
 */
export function generateGoogleCalendarWebUrl(title: string, organizer: string, targetDateTime: string): string {
  try {
    const startDate = new Date(targetDateTime);
    if (isNaN(startDate.getTime())) return '';
    
    // Exam duration 3 hours by default
    const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000);

    const formatGCalDate = (d: Date) => {
      return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const startFormatted = formatGCalDate(startDate);
    const endFormatted = formatGCalDate(endDate);

    const description = `จัดทำโดย: ${organizer || 'เพจเล่าเรื่องจากห้องแล็บ'}\nติดตามอัปเดต ข้อสอบ และเฉลยเนื้อหาเทคนิคการแพทย์ได้ที่ MTFeed\nhttps://ais-pre-sxlbz3cxdeegj7pgzxjjeo-449213994583.asia-southeast1.run.app`;

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `🔬 ${title || 'สอบสภาวิชาชีพเทคนิคการแพทย์'}`,
      dates: `${startFormatted}/${endFormatted}`,
      details: description,
      location: 'สนามสอบสภาวิชาชีพเทคนิคการแพทย์',
      sf: 'true',
      output: 'xml'
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  } catch {
    return '';
  }
}

/**
 * Generate and download .ics file
 */
export function downloadIcsCalendarFile(title: string, organizer: string, targetDateTime: string, endDateTime?: string | null) {
  try {
    const startDate = new Date(targetDateTime);
    if (isNaN(startDate.getTime())) return;
    const endDate = endDateTime && !isNaN(new Date(endDateTime).getTime())
      ? new Date(endDateTime)
      : new Date(startDate.getTime() + 3 * 60 * 60 * 1000);

    const formatIcsDate = (d: Date) => {
      return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//MTFeed//Medical Technology Exam Countdown//TH',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:mtfeed-exam-${startDate.getTime()}@mtfeed.app`,
      `DTSTAMP:${formatIcsDate(new Date())}`,
      `DTSTART:${formatIcsDate(startDate)}`,
      `DTEND:${formatIcsDate(endDate)}`,
      `SUMMARY:🔬 ${title || 'สอบสภาวิชาชีพเทคนิคการแพทย์'}`,
      `DESCRIPTION:จัดทำโดย ${organizer || 'เพจเล่าเรื่องจากห้องแล็บ'} - MTFeed`,
      'LOCATION:สนามสอบสภาวิชาชีพเทคนิคการแพทย์',
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-P1D',
      'ACTION:DISPLAY',
      'DESCRIPTION:แจ้งเตือนก่อนสอบสภา 1 วัน',
      'END:VALARM',
      'BEGIN:VALARM',
      'TRIGGER:-PT2H',
      'ACTION:DISPLAY',
      'DESCRIPTION:แจ้งเตือนก่อนสอบสภา 2 ชั่วโมง',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `MT_Exam_Schedule.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Failed to generate ICS file:', err);
  }
}

/**
 * Create or Update Event in Google Calendar using REST API
 */
export async function syncExamToGoogleCalendar(
  token: string,
  title: string,
  organizer: string,
  targetDateTime: string,
  existingEventId?: string | null,
  endDateTime?: string | null
): Promise<{ eventId: string; htmlLink?: string }> {
  const startDate = new Date(targetDateTime);
  const endDate = endDateTime && !isNaN(new Date(endDateTime).getTime())
    ? new Date(endDateTime)
    : new Date(startDate.getTime() + 3 * 60 * 60 * 1000); // 3 hours fallback

  const eventPayload = {
    summary: `🔬 ${title || 'สอบสภาวิชาชีพเทคนิคการแพทย์'}`,
    description: `จัดทำโดย: ${organizer || 'เพจเล่าเรื่องจากห้องแล็บ'}\nระบบนับถอยหลังวันเวลาสอบและเตรียมความพร้อมเทคนิคการแพทย์ MTFeed\n\n📌 อย่าลืมเตรียมบัตรประจำตัวสอบและอุปกรณ์ให้พร้อม`,
    location: 'สนามสอบสภาวิชาชีพเทคนิคการแพทย์',
    start: {
      dateTime: startDate.toISOString(),
      timeZone: 'Asia/Bangkok'
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: 'Asia/Bangkok'
    },
    colorId: '11', // Red color in Google Calendar
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 24 * 60 }, // 1 day before
        { method: 'popup', minutes: 2 * 60 },  // 2 hours before
        { method: 'popup', minutes: 30 }       // 30 min before
      ]
    }
  };

  const isUpdate = Boolean(existingEventId);
  const url = isUpdate
    ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${existingEventId}`
    : `https://www.googleapis.com/calendar/v3/calendars/primary/events`;

  const response = await fetch(url, {
    method: isUpdate ? 'PUT' : 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(eventPayload)
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    console.warn('Google Calendar sync failed:', errJson);
    // If event was not found for update, retry as new event creation
    if (isUpdate && response.status === 404) {
      return syncExamToGoogleCalendar(token, title, organizer, targetDateTime, null);
    }
    throw new Error(errJson.error?.message || 'Failed to sync event to Google Calendar');
  }

  const result = await response.json();
  return {
    eventId: result.id,
    htmlLink: result.htmlLink
  };
}

/**
 * Check if a specific Event exists and is active in Google Calendar
 */
export async function checkGoogleCalendarEventStatus(
  token: string,
  eventId: string
): Promise<{
  exists: boolean;
  isDeleted: boolean;
  eventData?: {
    id: string;
    summary: string;
    startIso: string;
    endIso?: string | null;
    htmlLink?: string;
    description?: string;
  };
}> {
  if (!eventId || !token) return { exists: false, isDeleted: true };

  try {
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.status === 404 || response.status === 410) {
      return { exists: false, isDeleted: true };
    }

    if (!response.ok) {
      console.warn(`[GCAL CHECK] Failed with status ${response.status}`);
      return { exists: false, isDeleted: false };
    }

    const data = await response.json();
    if (data.status === 'cancelled') {
      return { exists: false, isDeleted: true };
    }

    const startIso = data.start?.dateTime || data.start?.date || null;
    const endIso = data.end?.dateTime || data.end?.date || null;

    if (!startIso) {
      return { exists: false, isDeleted: true };
    }

    return {
      exists: true,
      isDeleted: false,
      eventData: {
        id: data.id,
        summary: data.summary || '',
        startIso,
        endIso,
        htmlLink: data.htmlLink,
        description: data.description
      }
    };
  } catch (err) {
    console.warn('[GCAL CHECK ERROR]', err);
    return { exists: false, isDeleted: false };
  }
}

/**
 * Search Google Calendar for existing MT exam countdown events
 */
export async function searchExamEventsInGoogleCalendar(
  token: string
): Promise<{
  found: boolean;
  eventData?: {
    id: string;
    summary: string;
    startIso: string;
    endIso?: string | null;
    htmlLink?: string;
    description?: string;
  };
}> {
  if (!token) return { found: false };

  const searchKeywords = ['สอบสภา', 'เทคนิคการแพทย์', 'MTFeed', 'นับถอยหลัง'];

  for (const keyword of searchKeywords) {
    try {
      const nowMinusOneDay = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?q=${encodeURIComponent(keyword)}&singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(nowMinusOneDay)}&maxResults=5`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) continue;

      const data = await response.json();
      const items = data.items || [];
      const activeEvent = items.find((item: any) => item.status !== 'cancelled' && (item.start?.dateTime || item.start?.date));

      if (activeEvent) {
        return {
          found: true,
          eventData: {
            id: activeEvent.id,
            summary: activeEvent.summary || 'นับถอยหลังวันเวลาสอบสภาเทคนิคการแพทย์',
            startIso: activeEvent.start?.dateTime || activeEvent.start?.date,
            endIso: activeEvent.end?.dateTime || activeEvent.end?.date || null,
            htmlLink: activeEvent.htmlLink,
            description: activeEvent.description
          }
        };
      }
    } catch (e) {
      console.warn('[GCAL SEARCH ERROR]', e);
    }
  }

  return { found: false };
}

/**
 * Delete Event from Google Calendar when countdown is cancelled/reset
 */
export async function deleteExamFromGoogleCalendar(
  token: string,
  eventId: string
): Promise<boolean> {
  if (!eventId) return false;
  try {
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok || response.status === 404 || response.status === 410) {
      console.log(`[GCAL] Event ${eventId} deleted from Google Calendar`);
      return true;
    }
    return false;
  } catch (err) {
    console.error('Failed to delete event from Google Calendar:', err);
    return false;
  }
}
