// Hub mode — 브라우저에서 AI API 직접 호출 없음.
// user 메시지를 Supabase에 source='sg2'로 저장 → 로컬 허브(Claude Code)가 감지해서 응답 생성 → realtime으로 수신.
import type { Character, GroupResponse } from '../types';
import { supabase } from './supabase';

const SOURCE = 'sg2';
const RESPONSE_TIMEOUT_MS = 60_000;

// ── 1:1 메시지 전송 ────────────────────────────────────────────────────────────
export async function sendMessageDirect(
  character: Character,
  userMessage: string
): Promise<string> {
  // 1. user 메시지 저장
  const { error } = await supabase.from('conversation_log').insert({
    character_id: character.id,
    role: 'user',
    content: userMessage,
    source: SOURCE,
  });
  if (error) throw new Error(`메시지 저장 실패: ${error.message}`);

  // 2. realtime으로 assistant 응답 대기
  return waitForAssistantReply(character.id);
}

// ── realtime 구독으로 assistant 응답 대기 ─────────────────────────────────────
function waitForAssistantReply(characterId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      supabase.removeChannel(channel);
      reject(new Error('응답 대기 시간 초과 (60초). 허브가 실행 중인지 확인해줘.'));
    }, RESPONSE_TIMEOUT_MS);

    const channel = supabase
      .channel(`reply-${characterId}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_log',
          filter: `character_id=eq.${characterId}`,
        },
        (payload) => {
          const row = payload.new as { role: string; content: string; source: string };
          if (row.role === 'assistant' && row.source === SOURCE) {
            clearTimeout(timer);
            supabase.removeChannel(channel);
            resolve(row.content);
          }
        }
      )
      .subscribe();
  });
}

// ── 단체 대화방 — 허브 모드 미지원 (기존 직접 호출 유지) ────────────────────────
// 단체방은 orchestrator 로직이 복잡하므로 일단 에러 반환
export async function sendGroupMessageDirect(
  _roomId: string,
  _userMessage: string,
  _onResponse?: (r: GroupResponse) => void,
  _onPlanReady?: (speakerIds: string[]) => void,
): Promise<{ responses: GroupResponse[]; participantIds: string[] }> {
  throw new Error('seoa-gram2 허브 모드에서는 단체 대화방 미지원');
}
