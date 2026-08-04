/**
 * Android home-screen widget (react-native-android-widget).
 *
 * The widget shows today's check-in count and dominant feeling, plus a
 * one-tap "log" button deep-linking into the log flow. Because the widget
 * task handler runs headless, it reads a small summary cached in
 * AsyncStorage — refreshed by the app on every save and app open.
 *
 * iOS note: WidgetKit requires a native Swift extension target, which is
 * out of scope for the JS-only pipeline — Android only for now.
 */
import React from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { FeelingEntry } from '../db';
import { getCore } from '../data/feelings';

const CACHE_KEY = 'roojifeel.widget.summary';

export interface WidgetSummary {
  todayCount: number;
  emoji: string | null;
  feelingEn: string | null;
  feelingAr: string | null;
  lang: string;
}

/** Recompute + cache the widget summary and push a widget refresh. */
export async function refreshWidget(entries: FeelingEntry[], lang: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  const now = new Date();
  const todays = entries.filter((e) => {
    const d = new Date(e.createdAt);
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  });
  const counts = new Map<string, number>();
  for (const e of todays) for (const f of e.feelings) counts.set(f.coreId, (counts.get(f.coreId) ?? 0) + 1);
  const topId = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
  const core = topId ? getCore(topId) : undefined;

  const summary: WidgetSummary = {
    todayCount: todays.length,
    emoji: core?.emoji ?? null,
    feelingEn: core?.en ?? null,
    feelingAr: core?.ar ?? null,
    lang,
  };
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(summary));

  try {
    const { requestWidgetUpdate } = await import('react-native-android-widget');
    await requestWidgetUpdate({
      widgetName: 'Roojifeel',
      renderWidget: () => <RoojifeelWidget summary={summary} />,
      widgetNotFound: () => {},
    });
  } catch {
    // Widget module unavailable (e.g. first run before prebuild) — ignore.
  }
}

async function loadSummary(): Promise<WidgetSummary> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fall through
  }
  return { todayCount: 0, emoji: null, feelingEn: null, feelingAr: null, lang: 'en' };
}

export function RoojifeelWidget({ summary }: { summary: WidgetSummary }) {
  const ar = summary.lang === 'ar';
  const feeling = ar ? summary.feelingAr : summary.feelingEn;
  const title = ar ? 'مشاعر اليوم' : "Today's feelings";
  const emptyText = ar ? 'بماذا تشعر الآن؟' : 'What are you feeling?';
  const logText = ar ? '+ سجّل شعوراً' : '+ Log a feeling';

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#0b0d12',
        borderRadius: 20,
        padding: 14,
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'roojifeel:///' }}
    >
      <FlexWidget style={{ flexDirection: 'column', backgroundColor: '#00000000' }}>
        <TextWidget
          text={title.toUpperCase()}
          style={{ fontSize: 9, color: '#6b7280', letterSpacing: 0.1 }}
        />
        {summary.todayCount > 0 && feeling ? (
          <FlexWidget
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#00000000',
              marginTop: 6,
            }}
          >
            <TextWidget text={summary.emoji ?? ''} style={{ fontSize: 26 }} />
            <FlexWidget
              style={{ flexDirection: 'column', marginLeft: 8, backgroundColor: '#00000000' }}
            >
              <TextWidget
                text={feeling}
                style={{ fontSize: 17, color: '#e6e8ef', fontWeight: 'bold' }}
              />
              <TextWidget
                text={`×${summary.todayCount}`}
                style={{ fontSize: 11, color: '#9ca3af' }}
              />
            </FlexWidget>
          </FlexWidget>
        ) : (
          <TextWidget
            text={emptyText}
            style={{ fontSize: 15, color: '#9ca3af', marginTop: 8 }}
          />
        )}
      </FlexWidget>

      <FlexWidget
        style={{
          backgroundColor: '#7c3aed',
          borderRadius: 12,
          padding: 10,
          alignItems: 'center',
          justifyContent: 'center',
          width: 'match_parent',
        }}
        clickAction="OPEN_URI"
        clickActionData={{ uri: 'roojifeel:///log' }}
      >
        <TextWidget text={logText} style={{ fontSize: 13, color: '#ffffff', fontWeight: 'bold' }} />
      </FlexWidget>
    </FlexWidget>
  );
}

/** Headless task handler — renders the widget from the cached summary. */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const summary = await loadSummary();
      props.renderWidget(<RoojifeelWidget summary={summary} />);
      break;
    }
    default:
      break;
  }
}
