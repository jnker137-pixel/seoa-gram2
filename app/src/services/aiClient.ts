// 직접 호출 모드 — seoa-gram1과 동일하게 Cloudflare Worker(/chat)를 직접 호출해 즉시 응답 받음.
// user/assistant 메시지는 source='sg2'로 Supabase에 저장 → App.tsx realtime 구독이 화면에 반영.
import type { Character, GroupResponse } from '../types';
import { supabase } from './supabase';

const SOURCE = 'sg2';
const WORKER_URL = 'https://seongmin-bot.jnkre137.workers.dev/chat';

// ── 1:1 메시지 전송 ────────────────────────────────────────────────────────────
export async function sendMessageDirect(
  character: Character,
  userMessage: string
): Promise<string> {
  // 1. user 메시지 저장
  const { error: userErr } = await supabase.from('conversation_log').insert({
    character_id: character.id,
    role: 'user',
    content: userMessage,
    source: SOURCE,
  });
  if (userErr) throw new Error(`메시지 저장 실패: ${userErr.message}`);

  // 2. Worker 호출 — 즉시 응답 (Worker 자체 저장은 skip, 여기서 source='sg2'로 저장)
  const res = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: userMessage,
      character_id: character.id,
      skip_save: true,
    }),
  });
  if (!res.ok) throw new Error(`AI 응답 실패 (${res.status})`);

  const data = await res.json();
  if (data.error) throw new Error(data.error);
  const reply = data.reply ?? '';

  // 3. assistant 응답 저장 → realtime으로 화면에 반영
  const { error: aiErr } = await supabase.from('conversation_log').insert({
    character_id: character.id,
    role: 'assistant',
    content: reply,
    source: SOURCE,
  });
  if (aiErr) throw new Error(`응답 저장 실패: ${aiErr.message}`);

  return reply;
}

// ── 단체 대화방 — 직접 호출 모드 미지원 (기존 직접 호출 유지) ────────────────────
// 단체방은 orchestrator 로직이 복잡하므로 일단 에러 반환
export async function sendGroupMessageDirect(
  _roomId: string,
  _userMessage: string,
  _onResponse?: (r: GroupResponse) => void,
  _onPlanReady?: (speakerIds: string[]) => void,
): Promise<{ responses: GroupResponse[]; participantIds: string[] }> {
  throw new Error('seoa-gram2 직접 호출 모드에서는 단체 대화방 미지원');
}
