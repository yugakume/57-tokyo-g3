export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  colorId?: string;       // Googleカレンダーのカラーラベル (1〜11)
  backgroundColor?: string; // カレンダー自体のカラー（イベントにcolorIdがない場合）
}

export async function fetchCalendarEvents(
  accessToken: string,
  timeMin: string, // ISO 8601
  timeMax: string, // ISO 8601
): Promise<CalendarEvent[]> {
  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
  url.searchParams.set('timeMin', timeMin);
  url.searchParams.set('timeMax', timeMax);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('maxResults', '100');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error('Failed to fetch calendar events');

  const data = await res.json();
  return (
    data.items?.map((item: Record<string, unknown>) => {
      const start = item.start as Record<string, string> | undefined;
      const end = item.end as Record<string, string> | undefined;
      return {
        id: item.id as string,
        title: (item.summary as string) || '(タイトルなし)',
        start: start?.dateTime || start?.date || '',
        end: end?.dateTime || end?.date || '',
        allDay: !start?.dateTime,
        colorId: item.colorId as string | undefined,
      };
    }) ?? []
  );
}
