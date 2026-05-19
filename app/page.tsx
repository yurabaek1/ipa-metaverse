'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Menu, MessageSquare, Users, User, X, Check, Copy, Send, Lock } from 'lucide-react';
import { PIXEL_SPRITES, CHAR_TYPES } from './lib/sprites'; 
import { generateNickname } from './lib/utils';

const BASE_W = 1600; 
const BASE_H = 900;  
const SPEED = 4;
const CHAR_SIZE = 48; 

const COLORS = {
  bg: '#e7bc91',
  grid: '#d4a373',
  primary: '#0ea5e9',
  border: '#94a3b8',
  text: '#1e293b',
  muted: '#64748b',
  room: 'rgba(255, 255, 255, 0.15)',
};

const ZONES = {
  breakRoom: { 
    x: 50, y: 50, w: 350, h: 250, name: '탕비실', type: 'public', color: COLORS.room,
    door: { x: 350 - 16, y: 150, w: 16, h: 80, wallType: 'right' } 
  },
  meetingRoom1: { 
    x: 1200, y: 50, w: 350, h: 350, name: '회의실 1', type: 'private', color: COLORS.room,
    door: { x: 0, y: 140, w: 16, h: 80, wallType: 'left' }
  },
  meetingRoom2: { 
    x: 1200, y: 450, w: 350, h: 400, name: '회의실 2', type: 'private', color: COLORS.room,
    door: { x: 0, y: 100, w: 16, h: 120, wallType: 'left' } 
  },
};

const ROOM_OBJECTS = [
  // ☕ 탕비실 가구
  { id: 'fridge', x: 70, y: 110, w: 40, h: 60, name: '냉장고', color: '#cbd5e1' },
  { id: 'dispenser', x: 120, y: 110, w: 30, h: 50, name: '정수기', color: '#38bdf8' },
  { id: 'snack_bar', x: 160, y: 120, w: 120, h: 40, name: '간식대', color: '#b45309' },
  { id: 'break_table', x: 140, y: 200, w: 80, h: 50, name: '휴식 테이블', color: '#d97706' },

  // 📝 회의실 1 가구
  { id: 'board1', x: 1320, y: 60, w: 120, h: 15, name: '화이트보드', color: '#ffffff' },
  { id: 'meet_table1', x: 1275, y: 160, w: 200, h: 100, name: '대형 회의 탁자', color: '#451a03' },

  // 📺 회의실 2 가구
  { id: 'screen2', x: 1300, y: 460, w: 150, h: 15, name: '프로젝터 스크린', color: '#f8fafc' },
  { id: 'meet_table2', x: 1275, y: 580, w: 200, h: 140, name: '대형 미팅 테이블', color: '#1e293b' },
];

const TABLES: { x: number; y: number; w: number; h: number }[] = [];
for (let set = 0; set < 3; set++) {
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 2; col++) {
      if (set === 2) {
        TABLES.push({ x: 850 + col * 120, y: 150 + row * 40, w: 100, h: 30 });
      } else {
        TABLES.push({ x: 550 + col * 120, y: 150 + set * 250 + row * 40, w: 100, h: 30 });
      }
    }
  }
}

export default function MetaversePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef_profile = useRef<HTMLCanvasElement>(null); 

  const [isMounted, setIsMounted] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    document.title = "Meta버스의 사무실 | shadcn × Stardew";
    setIsMounted(true); 
  }, []);

  const gameState = useRef({
    keys: { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false },
    joystick: { active: false, currentDx: 0, currentDy: 0, force: 0 },
    me: { 
      x: 200, y: 500, 
      type: CHAR_TYPES[Math.floor(Math.random() * CHAR_TYPES.length)],
      name: generateNickname(),
      id: 'my-id',
      chatTimestamp: 0,
      currentChat: '',
      dir: 'down',
      moving: false
    },
    dummies: [
      { id: 'bot1', x: 50, y: 360, type: CHAR_TYPES[0], name: '안내데스크봇', dir: 'down', chatTimestamp: 0, currentChat: '', moving: false, isNear: false, message: ["UX부문 사무실에 오신것을 환영합니다요"] },
      { id: 'bot2', x: 1300, y: 200, type: CHAR_TYPES[2], name: '회의실안내봇', dir: 'down', chatTimestamp: 0, currentChat: '', moving: false, isNear: false, message: ["프라이빗 모드입니다.", "이곳의 대화는 밖으로 🤫", "새어나가지 않아요!"] },
      { id: 'bot3', x: 200, y: 150, type: CHAR_TYPES[3], name: '탕비실봇', dir: 'down', chatTimestamp: 0, currentChat: '', moving: false, isNear: false, message: ["달달한 간식 드시고", "오늘 하루도 화이팅! 🍩"] }
    ],
    scale: { x: 1, y: 1 },
    animTick: 0,
    unlockedRoom2: false,         // 회의실 2 잠금 상태
    isPromptingPassword: false,   // 비밀번호 입력 중 이동 방지 플래그
    hasPromptedForRoom2: false    // 무한 팝업 루프 방지용 플래그
  });

  const [currentZone, setCurrentZone] = useState('공용 공간');
  const [isPrivate, setIsPrivate] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<{id: string, name: string, text: string, isMe: boolean, zone: string}[]>([]);
  const [uiState, setUiState] = useState({ menu: false, users: false, profile: false });
  const [editName, setEditName] = useState(gameState.current.me.name); 

  // 비밀번호 입력 팝업 State
  const [passwordPopup, setPasswordPopup] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const joystickStickRef = useRef<HTMLDivElement>(null);

  // 🎯 문으로만 통과할 수 있게 수정한 충돌 검사 로직
  const checkCollision = (newX: number, newY: number) => {
    if (newX < 0 || newX + CHAR_SIZE > BASE_W || newY < 0 || newY + CHAR_SIZE > BASE_H) return true;
    
    // 캐릭터 몸통 바운딩 박스
    const charRect = { x: newX + 8, y: newY + 24, w: CHAR_SIZE - 16, h: CHAR_SIZE - 24 }; 
    const WALL_THICK = 16; 

    for (const [zoneKey, zone] of Object.entries(ZONES)) {
      const doorTopY = zone.y + zone.door.y;
      const doorBotY = doorTopY + zone.door.h;
      const doorLeftX = zone.x + zone.door.x;
      const doorRightX = doorLeftX + zone.door.w;

      const walls = [
        { type: 'top', x: zone.x, y: zone.y, w: zone.w, h: WALL_THICK },
        { type: 'bottom', x: zone.x, y: zone.y + zone.h - WALL_THICK, w: zone.w, h: WALL_THICK },
        { type: 'left', x: zone.x, y: zone.y, w: WALL_THICK, h: zone.h },
        { type: 'right', x: zone.x + zone.w - WALL_THICK, y: zone.y, w: WALL_THICK, h: zone.h }
      ];

      let collisionRects: {x: number, y: number, w: number, h: number}[] = [];
      
      walls.forEach(w => {
        if (w.type === zone.door.wallType) {
          // 문의 위치를 기준으로 벽을 2개로 쪼갭니다 (문이 있는 공간만 비우기)
          if (w.type === 'left' || w.type === 'right') {
            const upperH = doorTopY - w.y;
            if (upperH > 0) collisionRects.push({ x: w.x, y: w.y, w: w.w, h: upperH });
            const lowerH = (w.y + w.h) - doorBotY;
            if (lowerH > 0) collisionRects.push({ x: w.x, y: doorBotY, w: w.w, h: lowerH });
          } else {
            const leftW = doorLeftX - w.x;
            if (leftW > 0) collisionRects.push({ x: w.x, y: w.y, w: leftW, h: w.h });
            const rightW = (w.x + w.w) - doorRightX;
            if (rightW > 0) collisionRects.push({ x: doorRightX, y: w.y, w: rightW, h: w.h });
          }
        } else {
          collisionRects.push(w); // 문이 없는 벽은 그대로 추가
        }
      });

      // 잠긴 방(회의실2)은 뚫려있는 문 공간도 단단한 벽으로 취급하여 막습니다.
      if (zoneKey === 'meetingRoom2' && !gameState.current.unlockedRoom2) {
        collisionRects.push({ x: doorLeftX, y: doorTopY, w: zone.door.w, h: zone.door.h });
      }

      // 생성된 실제 벽 조각들과 캐릭터의 충돌을 정밀하게 검사합니다.
      for (const rect of collisionRects) {
        if (
          charRect.x < rect.x + rect.w &&
          charRect.x + charRect.w > rect.x &&
          charRect.y < rect.y + rect.h &&
          charRect.y + charRect.h > rect.y
        ) {
          return true;
        }
      }
    }

    // 3. 중앙 사무실 데스크 충돌 검사
    for (const table of TABLES) {
      if (charRect.x < table.x + table.w && charRect.x + charRect.w > table.x &&
          charRect.y < table.y + table.h && charRect.y + table.h > table.y) {
        return true;
      }
    }

    // 4. 룸 가구 소품 충돌 검사
    for (const obj of ROOM_OBJECTS) {
      if (charRect.x < obj.x + obj.w && charRect.x + charRect.w > obj.x &&
          charRect.y < obj.y + obj.h && charRect.y + obj.h > obj.y) {
        return true;
      }
    }

    return false;
  };

  const drawModernDesk = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
    ctx.save();
    ctx.fillStyle = '#8b5a2b'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#5c3a21'; ctx.fillRect(x, y + h - 4, w, 4); 
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(x + 15, y + 4, 20, 12);
    ctx.fillStyle = '#334155'; ctx.fillRect(x + 50, y + 6, 25, 10);
    ctx.restore();
  };

  const drawRoomObject = (ctx: CanvasRenderingContext2D, obj: any) => {
    ctx.save();
    const { x, y, w, h, id } = obj;

    switch (id) {
      case 'fridge':
        ctx.fillStyle = '#94a3b8'; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#64748b'; ctx.fillRect(x, y + h/2 - 2, w, 4);
        ctx.fillStyle = '#cbd5e1'; ctx.fillRect(x + w - 8, y + 10, 4, h/2 - 20);
        ctx.fillStyle = '#cbd5e1'; ctx.fillRect(x + w - 8, y + h/2 + 10, 4, h/2 - 20);
        break;
      case 'dispenser':
        ctx.fillStyle = '#e2e8f0'; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#38bdf8'; ctx.fillRect(x + 4, y + 4, w - 8, 16);
        ctx.fillStyle = '#ef4444'; ctx.fillRect(x + 6, y + 28, 4, 6);
        ctx.fillStyle = '#3b82f6'; ctx.fillRect(x + w - 10, y + 28, 4, 6);
        ctx.fillStyle = '#94a3b8'; ctx.fillRect(x + 4, y + h - 10, w - 8, 4);
        break;
      case 'snack_bar':
        ctx.fillStyle = '#78350f'; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#b45309'; ctx.fillRect(x + 2, y + 2, w - 4, h - 6);
        ctx.fillStyle = '#f472b6'; ctx.fillRect(x + 15, y + 6, 16, 12);
        ctx.fillStyle = '#f59e0b'; ctx.fillRect(x + 50, y + 8, 10, 10);
        ctx.fillStyle = '#10b981'; ctx.fillRect(x + 80, y + 4, 12, 14);
        break;
      case 'break_table':
        ctx.fillStyle = '#d97706'; ctx.beginPath(); ctx.arc(x + w/2, y + h/2, w/2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#b45309'; ctx.beginPath(); ctx.arc(x + w/2, y + h/2, w/2 - 4, 0, Math.PI * 2); ctx.fill();
        break;
      case 'board1':
        ctx.fillStyle = '#475569'; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 3, y + 2, w - 6, h - 4);
        ctx.fillStyle = '#ef4444'; ctx.fillRect(x + 20, y + h - 2, 6, 2);
        ctx.fillStyle = '#3b82f6'; ctx.fillRect(x + 30, y + h - 2, 6, 2);
        break;
      case 'meet_table1':
      case 'meet_table2':
        ctx.fillStyle = id === 'meet_table1' ? '#451a03' : '#334155'; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = id === 'meet_table1' ? '#78350f' : '#475569'; ctx.fillRect(x + 4, y + 4, w - 8, h - 12);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 30, y + 15, 16, 20);
        ctx.fillStyle = '#0ea5e9'; ctx.fillRect(x + w - 50, y + h - 30, 22, 14);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x + w - 46, y + h - 26, 14, 8);
        break;
      default:
        ctx.fillStyle = obj.color; ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
  };

  const getPixelColors = useCallback((char: any) => ({
    '1': char.type.hair,
    '2': '#ffedd5', 
    '3': char.type.shirt,
    '4': '#1e3a8a', 
    '5': '#451a03', 
    '6': '#000000'  
  }), []);

  const drawCharacterFace = useCallback((ctx: CanvasRenderingContext2D, char: any) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.save();
    
    const frameData = PIXEL_SPRITES['down'][0];
    const pixelColors = getPixelColors(char);
    const faceRows = 5; 
    const faceCols = 10; 
    const FACE_SCALE = 14; 
    
    ctx.scale(FACE_SCALE, FACE_SCALE);
    const offsetX = (ctx.canvas.width / FACE_SCALE - faceCols) / 2;
    const offsetY = (ctx.canvas.height / FACE_SCALE - faceRows) / 2;

    for (let r = 0; r < 5; r++) {
      const rowStr = frameData[r];
      for (let c = 0; c < faceCols; c++) {
        const val = rowStr[c];
        if (val !== '0' && pixelColors[val]) {
          ctx.fillStyle = pixelColors[val];
          ctx.fillRect(offsetX + c, offsetY + r, 1, 1);
        }
      }
    }
    ctx.restore();
  }, [getPixelColors]);

  const drawCharacter = useCallback((ctx: CanvasRenderingContext2D, char: any, isMe: boolean) => {
    ctx.save();
    ctx.translate(char.x, char.y);

    const PIXEL_SCALE = 4; 
    const OFFSET_X = 4;    

    let frameIdx = 0;
    if (char.moving) {
      frameIdx = Math.floor(gameState.current.animTick / 8) % 4;
    }

    const frameData = PIXEL_SPRITES[char.dir][frameIdx];
    const pixelColors = getPixelColors(char);

    for (let r = 0; r < 12; r++) {
      const rowStr = frameData[r];
      for (let c = 0; c < 10; c++) {
        const val = rowStr[c];
        if (val !== '0') {
          ctx.fillStyle = pixelColors[val];
          ctx.fillRect(OFFSET_X + c * PIXEL_SCALE, r * PIXEL_SCALE, PIXEL_SCALE, PIXEL_SCALE);
        }
      }
    }

    ctx.font = '700 13px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.strokeText(char.name, CHAR_SIZE / 2, -10);
    ctx.fillStyle = isMe ? '#38bdf8' : '#ffffff';
    ctx.fillText(char.name, CHAR_SIZE / 2, -10);

    const drawBubble = (lines: string[], startY: number) => {
      ctx.save();
      ctx.font = '500 13px system-ui, sans-serif';
      const lineHeight = 18;
      const paddingX = 14;
      const paddingY = 10;
      
      let maxW = 0;
      lines.forEach(line => {
        const w = ctx.measureText(line).width;
        if (w > maxW) maxW = w;
      });
      
      const boxW = maxW + paddingX * 2;
      const boxH = lines.length * lineHeight + paddingY * 2;
      const bubbleY = startY - boxH - 8; 
      const bubbleX = CHAR_SIZE / 2 - boxW / 2;
      
      ctx.shadowColor = 'rgba(0,0,0,0.1)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 4;
      
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.roundRect(bubbleX, bubbleY, boxW, boxH, 12);
      ctx.moveTo(CHAR_SIZE / 2 - 6, bubbleY + boxH);
      ctx.lineTo(CHAR_SIZE / 2, bubbleY + boxH + 8);
      ctx.lineTo(CHAR_SIZE / 2 + 6, bubbleY + boxH);
      ctx.fill();
      
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      ctx.fillStyle = '#1e293b';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      lines.forEach((line, i) => {
        ctx.fillText(line, CHAR_SIZE / 2, bubbleY + paddingY + (i * lineHeight) + (lineHeight / 2));
      });
      ctx.restore();
    };

    if (!isMe && char.isNear && char.message) {
      drawBubble(char.message, -25);
    }
    ctx.restore();
  }, [getPixelColors]);

  useEffect(() => {
    const handleResize = () => {
      const { innerWidth, innerHeight } = window;
      setWindowSize({ width: innerWidth, height: innerHeight });
      const scale = Math.max(innerWidth / BASE_W, innerHeight / BASE_H);
      gameState.current.scale.x = scale;
      gameState.current.scale.y = scale;
    };
    handleResize(); 
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 메인 인게임 캔버스 루프 
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || windowSize.width === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = windowSize.width;
    canvas.height = windowSize.height;

    let animationFrameId: number;

    const render = () => {
      const state = gameState.current;
      const { me, dummies, keys, joystick, scale } = state;

      state.animTick++;

      let dx = 0; let dy = 0;
      let moving = false;
      let dir = me.dir;

      // 팝업이 떠있지 않을 때만 조작 가능
      if (!state.isPromptingPassword) {
        if (keys.w || keys.ArrowUp) { dy -= SPEED; dir = 'up'; moving = true; }
        else if (keys.s || keys.ArrowDown) { dy += SPEED; dir = 'down'; moving = true; }
        
        if (keys.a || keys.ArrowLeft) { dx -= SPEED; dir = 'left'; moving = true; }
        else if (keys.d || keys.ArrowRight) { dx += SPEED; dir = 'right'; moving = true; }

        if (joystick.active && joystick.force > 0.05) {
          dx = joystick.currentDx;
          dy = joystick.currentDy;
          moving = true;
          const angle = Math.atan2(dy, dx) * 180 / Math.PI;
          if (angle > -45 && angle <= 45) dir = 'right';
          else if (angle > 45 && angle <= 135) dir = 'down';
          else if (angle > 135 || angle <= -135) dir = 'left';
          else dir = 'up';
        }

        if (dx !== 0 && dy !== 0 && !joystick.active) {
          const length = Math.sqrt(dx * dx + dy * dy);
          dx = (dx / length) * SPEED;
          dy = (dy / length) * SPEED;
        }
      }

      me.moving = moving;
      me.dir = dir;

      // 🔒 회의실 2 비밀번호 접근 트리거 로직
      const room2 = ZONES.meetingRoom2;
      const door2X = room2.x + room2.door.x + room2.door.w / 2;
      const door2Y = room2.y + room2.door.y + room2.door.h / 2;
      // 캐릭터 중심과 문의 거리 측정
      const distToDoor2 = Math.hypot((me.x + dx + CHAR_SIZE/2) - door2X, (me.y + dy + CHAR_SIZE/2) - door2Y);

      // 튕기지 않고 무한 팝업을 방지하기 위해 hasPromptedForRoom2 플래그를 확인합니다.
      if (distToDoor2 < 55 && !state.unlockedRoom2 && !state.isPromptingPassword && !state.hasPromptedForRoom2) {
        state.isPromptingPassword = true;
        state.hasPromptedForRoom2 = true; // 팝업 띄움 표시
        // 충돌 직전 이동 무효화 및 눌려있던 모든 방향키 초기화 (미끄러짐/버그 방지)
        dx = 0; dy = 0; me.moving = false;
        Object.keys(state.keys).forEach(k => state.keys[k as keyof typeof state.keys] = false);

        // 리액트 State 업데이트 유발
        setTimeout(() => setPasswordPopup(true), 0);
      }

      // 문에서 충분히 멀어지면 다시 팝업이 뜰 수 있도록 플래그 해제
      if (distToDoor2 >= 65) {
        state.hasPromptedForRoom2 = false;
      }

      // 팝업이 활성화되어 있으면 무조건 이동 금지
      if (state.isPromptingPassword) {
        dx = 0; dy = 0; me.moving = false;
      }

      if (!checkCollision(me.x + dx, me.y)) me.x += dx;
      if (!checkCollision(me.x, me.y + dy)) me.y += dy;

      let currentArea = '공용 공간';
      let inPrivate = false;
      const charCenter = { x: me.x + CHAR_SIZE/2, y: me.y + CHAR_SIZE/2 };
      Object.values(ZONES).forEach(zone => {
        if (charCenter.x > zone.x && charCenter.x < zone.x + zone.w &&
            charCenter.y > zone.y && charCenter.y < zone.y + zone.h) {
          currentArea = zone.name;
          if (zone.type === 'private') inPrivate = true;
        }
      });
      setCurrentZone(prev => prev !== currentArea ? currentArea : prev);
      setIsPrivate(prev => prev !== inPrivate ? inPrivate : prev);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(scale.x, scale.y); 

      const logicalWidth = canvas.width / scale.x;
      const logicalHeight = canvas.height / scale.y;
      let cameraX = logicalWidth / 2 - (me.x + CHAR_SIZE / 2);
      let cameraY = logicalHeight / 2 - (me.y + CHAR_SIZE / 2);
      cameraX = Math.min(0, Math.max(logicalWidth - BASE_W, cameraX));
      cameraY = Math.min(0, Math.max(logicalHeight - BASE_H, cameraY));
      ctx.translate(cameraX, cameraY);

      // 바닥 타일 드로잉
      ctx.fillStyle = COLORS.bg; 
      ctx.fillRect(0, 0, BASE_W, BASE_H);
      ctx.strokeStyle = COLORS.grid; 
      ctx.lineWidth = 2;
      const tileSize = 48;

      for (let x = 0; x <= BASE_W; x += tileSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, BASE_H); ctx.stroke();
      }
      for (let y = 0; y <= BASE_H; y += tileSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(BASE_W, y); ctx.stroke();
      }

      // 웰컴 존 꾸미기
      ctx.save();
      const matX = 0; const matY = 380; const matW = 200; const matH = 180;
      ctx.fillStyle = '#cbd5e1'; ctx.beginPath(); ctx.roundRect(matX, matY, matW, matH, [0, 16, 16, 0]); ctx.fill();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)'; ctx.lineWidth = 0.5;
      for (let tx = matX + 20; tx < matX + matW; tx += 20) {
        ctx.beginPath(); ctx.moveTo(tx, matY); ctx.lineTo(tx, matY + matH); ctx.stroke();
      }
      for (let ty = matY + 20; ty < matY + matH; ty += 20) {
        ctx.beginPath(); ctx.moveTo(matX, ty); ctx.lineTo(matX + matW, ty); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(71, 85, 105, 0.6)'; ctx.font = '700 32px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('WELCOME', matX + matW / 2, matY + matH / 2);

      const drawPlant = (px: number, py: number) => {
        ctx.fillStyle = '#a1a1aa'; ctx.fillRect(px, py, 30, 25);
        ctx.fillStyle = '#78350f'; ctx.fillRect(px + 3, py + 2, 24, 4);
        ctx.fillStyle = '#16a34a'; ctx.beginPath(); ctx.arc(px + 15, py - 5, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#15803d'; ctx.beginPath(); ctx.arc(px + 5, py + 2, 9, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + 25, py + 2, 9, 0, Math.PI * 2); ctx.fill();
      };
      drawPlant(matX + matW - 40, matY - 35);
      drawPlant(matX + matW - 40, matY + matH + 10);
      ctx.restore();

      // 벽면 및 방 렌더링
      Object.entries(ZONES).forEach(([zoneKey, zone]) => {
        ctx.save();
        ctx.fillStyle = zone.type === 'private' ? 'rgba(109, 85, 68, 0.12)' : 'rgba(255, 255, 255, 0.12)';
        ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
        
        const WALL_THICK = 16;
        const topColor = zone.type === 'private' ? '#5c4033' : '#6d594f';   
        const frontColor = zone.type === 'private' ? '#3d251d' : '#4a3b32'; 
        const shadowColor = 'rgba(0, 0, 0, 0.15)';                          

        const walls = [
          { type: 'top', x: zone.x, y: zone.y, w: zone.w, h: WALL_THICK },                         
          { type: 'bottom', x: zone.x, y: zone.y + zone.h - WALL_THICK, w: zone.w, h: WALL_THICK },   
          { type: 'left', x: zone.x, y: zone.y, w: WALL_THICK, h: zone.h },                         
          { type: 'right', x: zone.x + zone.w - WALL_THICK, y: zone.y, w: WALL_THICK, h: zone.h }    
        ];

        ctx.fillStyle = shadowColor; ctx.fillRect(zone.x - 4, zone.y - 4, zone.w + 8, zone.h + 8);
        ctx.fillStyle = zone.type === 'private' ? 'rgba(109, 85, 68, 0.12)' : 'rgba(255, 255, 255, 0.12)';
        ctx.fillRect(zone.x, zone.y, zone.w, zone.h);

        walls.forEach(w => {
          const isDoorWall = w.type === zone.door.wallType;
          if (isDoorWall) {
            const doorTopY = zone.y + zone.door.y;
            const doorBotY = doorTopY + zone.door.h;

            const upperH = doorTopY - w.y;
            if (upperH > 0) {
              ctx.fillStyle = frontColor; ctx.fillRect(w.x, w.y, w.w, upperH);
              ctx.fillStyle = topColor; ctx.fillRect(w.x, w.y, w.w, Math.max(4, upperH * 0.6));
            }
            const lowerH = (w.y + w.h) - doorBotY;
            if (lowerH > 0) {
              ctx.fillStyle = frontColor; ctx.fillRect(w.x, doorBotY, w.w, lowerH);
              ctx.fillStyle = topColor; ctx.fillRect(w.x, doorBotY, w.w, Math.max(4, lowerH * 0.6));
            }
          } else {
            ctx.fillStyle = frontColor; ctx.fillRect(w.x, w.y, w.w, w.h);
            ctx.fillStyle = topColor; ctx.fillRect(w.x, w.y, w.w, Math.max(4, w.h * 0.6));
          }
        });

        // 🚪 자연스러운 나무 문 그리기
        const actualDoorX = zone.x + zone.door.x;
        const actualDoorY = zone.y + zone.door.y;
        ctx.save();
        ctx.fillStyle = '#b48460'; 
        ctx.fillRect(actualDoorX, actualDoorY, zone.door.w, zone.door.h);
        ctx.strokeStyle = '#8a6a4b'; 
        ctx.lineWidth = 1; 
        ctx.strokeRect(actualDoorX, actualDoorY, zone.door.w, zone.door.h);
        
        // 회의실2 잠금 표시 or 손잡이
        if (zoneKey === 'meetingRoom2' && !state.unlockedRoom2) {
          const cx = actualDoorX + zone.door.w / 2;
          const cy = actualDoorY + zone.door.h / 2;
          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(cx - 4, cy - 2, 8, 7);
          ctx.strokeStyle = '#b45309';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy - 2, 3, Math.PI, 0);
          ctx.stroke();
        } else {
          ctx.fillStyle = '#fcd34d'; 
          ctx.beginPath();
          ctx.arc(actualDoorX + zone.door.w / 2, actualDoorY + zone.door.h / 2, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        ctx.font = '700 18px system-ui, sans-serif';
        const text = zone.name;
        const textWidth = ctx.measureText(text).width;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.strokeStyle = frontColor; ctx.lineWidth = 2;
        ctx.fillRect(zone.x + WALL_THICK + 12, zone.y + WALL_THICK + 10, textWidth + 16, 28);
        ctx.strokeRect(zone.x + WALL_THICK + 12, zone.y + WALL_THICK + 10, textWidth + 16, 28);
        ctx.fillStyle = '#2b1810'; ctx.fillText(text, zone.x + WALL_THICK + 20, zone.y + WALL_THICK + 30);
        ctx.restore();
      });

      // 가구 및 중앙 데스크 렌더링
      TABLES.forEach(t => drawModernDesk(ctx, t.x, t.y, t.w, t.h));
      ROOM_OBJECTS.forEach(obj => drawRoomObject(ctx, obj));

      dummies.forEach(bot => {
        const dist = Math.sqrt(Math.pow(bot.x - me.x, 2) + Math.pow(bot.y - me.y, 2));
        bot.isNear = dist < 120;
      });

      const allChars = [me, ...dummies].sort((a, b) => (a.y + CHAR_SIZE) - (b.y + CHAR_SIZE));
      allChars.forEach(char => drawCharacter(ctx, char, char.id === 'my-id'));

      if (inPrivate) {
        ctx.save();
        ctx.beginPath(); ctx.rect(0, 0, BASE_W, BASE_H);
        const activeZone = Object.values(ZONES).find(z => z.name === currentArea);
        if (activeZone) {
          ctx.roundRect(activeZone.x, activeZone.y, activeZone.w, activeZone.h, 12);
        }
        ctx.fillStyle = 'rgba(15, 23, 42, 0.5)'; ctx.fill('evenodd'); 
        ctx.restore();
      }

      ctx.restore(); 
      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [windowSize, drawCharacter, isMounted]);

  // 키 제어 시스템
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      if (gameState.current.keys.hasOwnProperty(e.key)) {
        gameState.current.keys[e.key as keyof typeof gameState.current.keys] = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      // 입력창 포커스 여부와 상관없이 KeyUp 이벤트는 항상 처리하여 키 갇힘(Stuck Key) 버그 방지
      if (gameState.current.keys.hasOwnProperty(e.key)) {
        gameState.current.keys[e.key as keyof typeof gameState.current.keys] = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (uiState.profile && canvasRef_profile.current) {
      const ctx_profile = canvasRef_profile.current.getContext('2d');
      if (ctx_profile) {
        canvasRef_profile.current.width = 96; 
        canvasRef_profile.current.height = 96; 
        drawCharacterFace(ctx_profile, gameState.current.me);
      }
    }
  }, [uiState.profile, drawCharacterFace, editName]);

  const handleJoystickMove = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    if (!gameState.current.joystick.active || !joystickBaseRef.current || !joystickStickRef.current) return;
    
    let clientX, clientY;
    if ('touches' in e && (e as React.TouchEvent).touches.length > 0) {
      clientX = (e as React.TouchEvent).touches[0].clientX;
      clientY = (e as React.TouchEvent).touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = (e as MouseEvent).clientX;
      clientY = (e as MouseEvent).clientY;
    } else {
      return;
    }

    const rect = joystickBaseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const screenDx = clientX - centerX;
    const screenDy = clientY - centerY;
    const dist = Math.sqrt(screenDx * screenDx + screenDy * screenDy);
    const maxDist = rect.width / 2 - 24; 

    const nx = dist === 0 ? 0 : screenDx / dist;
    const ny = dist === 0 ? 0 : screenDy / dist;
    const moveDist = Math.min(dist, maxDist);
    
    gameState.current.joystick.currentDx = nx * SPEED;
    gameState.current.joystick.currentDy = ny * SPEED;
    gameState.current.joystick.force = moveDist / maxDist;
    
    joystickStickRef.current.style.transform = `translate(${nx * moveDist}px, ${ny * moveDist}px)`;
  };

  const startJoystick = (e: React.MouseEvent | React.TouchEvent) => {
    gameState.current.joystick.active = true;
    if (joystickStickRef.current) joystickStickRef.current.style.transition = 'none'; 
    handleJoystickMove(e);
    window.addEventListener('mousemove', handleJoystickMove as any);
    window.addEventListener('touchmove', handleJoystickMove as any, { passive: false });
  };

  const stopJoystick = () => {
    gameState.current.joystick.active = false;
    gameState.current.joystick.force = 0;
    gameState.current.joystick.currentDx = 0;
    gameState.current.joystick.currentDy = 0;

    if (joystickStickRef.current) {
      joystickStickRef.current.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
      joystickStickRef.current.style.transform = 'translate(0px, 0px)'; 
    }
    window.removeEventListener('mousemove', handleJoystickMove as any);
    window.removeEventListener('touchmove', handleJoystickMove as any);
  };

  useEffect(() => {
    window.addEventListener('mouseup', stopJoystick);
    window.addEventListener('touchend', stopJoystick);
    return () => {
      window.removeEventListener('mouseup', stopJoystick);
      window.removeEventListener('touchend', stopJoystick);
    };
  }, []);

  const sendChat = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim()) return;
    
    const newMsg = { 
      id: Date.now().toString(), 
      name: gameState.current.me.name, 
      text: chatInput, 
      isMe: true, 
      zone: currentZone 
    };
    
    setMessages(prev => [...prev.slice(-49), newMsg]);
    gameState.current.me.currentChat = chatInput;
    gameState.current.me.chatTimestamp = Date.now();
    setChatInput('');
  };

  const handleNameChange = () => {
    if (editName.length > 0 && editName.length <= 9) {
      gameState.current.me.name = editName;
      setUiState({ ...uiState, profile: false });
    } else {
      alert("닉네임 길이를 확인해주세요.");
    }
  };

  // 비밀번호 확인 로직
  const handlePasswordSubmit = () => {
    if (passwordInput === '1234') {
      gameState.current.unlockedRoom2 = true;
      gameState.current.isPromptingPassword = false; // 이동 가능 상태로 복구
      setPasswordPopup(false);
      setPasswordInput('');
    } else {
      alert('비밀번호가 일치하지 않습니다.');
      setPasswordInput(''); // 틀렸을 때 입력칸만 비워줍니다.
    }
  };

  // 비밀번호 취소 로직
  const handlePasswordCancel = () => {
    gameState.current.isPromptingPassword = false; // 이동 가능 상태로 복구
    setPasswordPopup(false);
    setPasswordInput('');
  };

  if (!isMounted) {
    return (
      <div className="fixed inset-0 w-screen h-screen bg-zinc-50 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-zinc-500 font-medium">메타버스 공간 진입 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-zinc-50 font-sans text-zinc-900">
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* 비밀번호 입력 팝업 */}
      {passwordPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-2xl p-6 w-80 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95">
            <div className="flex items-center gap-2 text-zinc-900 border-b pb-3">
              <Lock className="w-5 h-5 text-sky-500" />
              <h3 className="font-bold text-lg">회의실 2 입장</h3>
            </div>
            <p className="text-sm text-zinc-600 font-medium">비밀번호를 입력하세요.</p>
            <input 
              type="password" 
              autoFocus
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handlePasswordSubmit(); }}
              className="border border-zinc-300 rounded-lg p-3 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition text-zinc-900"
              placeholder="비밀번호 입력"
            />
            <div className="flex justify-end gap-2 mt-2">
              <button 
                onClick={handlePasswordCancel}
                className="px-4 py-2 bg-zinc-100 text-zinc-700 font-medium rounded-lg hover:bg-zinc-200 transition"
              >
                취소
              </button>
              <button 
                onClick={handlePasswordSubmit}
                className="px-4 py-2 bg-sky-500 text-white font-medium rounded-lg hover:bg-sky-600 shadow-sm shadow-sky-200 transition active:scale-95"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 좌상단 메뉴 버튼 */}
      <button 
        onClick={() => setUiState({...uiState, menu: true})}
        className="absolute top-4 left-4 w-12 h-12 bg-white/80 hover:bg-white backdrop-blur-sm rounded-xl border border-zinc-200 shadow-sm flex items-center justify-center transition active:scale-95 z-40"
      >
        <Menu className="w-5 h-5 text-zinc-600" />
      </button>

      {/* 우상단 플레이어/프로필 버튼 세트 */}
      <div className="absolute top-4 right-4 flex gap-3 z-40">
        <button 
          onClick={() => setUiState({...uiState, users: true})}
          className="relative w-12 h-12 bg-white/80 hover:bg-white backdrop-blur-sm rounded-xl border border-zinc-200 shadow-sm flex items-center justify-center transition active:scale-95"
        >
          <Users className="w-5 h-5 text-zinc-600" />
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-sky-500 rounded-full border-2 border-white flex items-center justify-center text-xs font-semibold text-white">4</span>
        </button>
        <button 
          onClick={() => setUiState({...uiState, profile: true})}
          className="w-12 h-12 bg-sky-500 hover:bg-sky-600 rounded-xl shadow-md shadow-sky-100 flex items-center justify-center transition active:scale-95"
        >
          <User className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* 가상 조이스틱 */}
      <div 
        ref={joystickBaseRef}
        onMouseDown={startJoystick}
        onTouchStart={startJoystick}
        className="absolute bottom-8 left-8 w-32 h-32 bg-zinc-950/5 backdrop-blur-xs rounded-full border border-zinc-950/10 flex items-center justify-center touch-none select-none z-10 shadow-inner"
      >
        <div 
          ref={joystickStickRef}
          className="w-14 h-14 bg-white rounded-full border border-zinc-200 shadow-xl pointer-events-none"
        ></div>
      </div>

      {/* 실시간 채팅창 컴포넌트 */}
      <div className={`absolute bottom-6 left-48 w-96 h-72 flex flex-col rounded-2xl shadow-lg border border-white/40 transition-all duration-300 backdrop-blur-xs ${isPrivate ? 'bg-zinc-900/45 text-sky-100' : 'bg-white/45 text-zinc-900'}`}>
        {isPrivate && (
          <div className="bg-sky-600/20 text-sky-400 text-xs font-semibold py-2 px-3 flex items-center gap-2 border-b border-sky-400/20">
            <span className="w-2 h-2 bg-sky-400 rounded-full animate-pulse"></span>
            프라이빗 모드 ({currentZone} 대화)
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 no-scrollbar text-[13px]">
          {messages
            .filter((msg) => msg.zone === currentZone) 
            .map((msg) => (
            <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] rounded-xl px-3 py-2 shadow-sm ${msg.isMe ? 'bg-sky-500 text-white rounded-br-none' : (isPrivate ? 'bg-zinc-800/90 text-sky-100 rounded-bl-none border border-zinc-700' : 'bg-white text-zinc-900 rounded-bl-none border border-zinc-200')}`}>
                {!msg.isMe && <div className={`text-xs font-semibold mb-1 ${isPrivate ? 'text-sky-300' : 'text-zinc-500'}`}>{msg.name}</div>}
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={sendChat} className="p-3 border-t border-zinc-200/30 flex gap-2 bg-white/10 rounded-b-2xl">
          <input 
            type="text" 
            value={chatInput}
            onChange={(e) => setChatInput(e.value || e.target.value)}
            placeholder="메시지를 입력하세요..." 
            className={`flex-1 h-9 rounded-md px-3 text-sm outline-none focus:ring-2 focus:ring-sky-300 transition ${isPrivate ? 'bg-zinc-900/60 border border-zinc-700/50 text-white' : 'bg-white/80 border border-zinc-200 text-zinc-900'}`}
          />
          <button type="submit" className="h-9 px-4 bg-zinc-900 text-white rounded-md hover:bg-zinc-800 transition active:scale-95 flex items-center justify-center shadow">
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* 햄버거 슬라이드 메뉴 */}
      <div 
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${uiState.menu ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setUiState({...uiState, menu: false})}
      >
        <div className="absolute inset-0 bg-black/30 backdrop-blur-xs"></div>
        <div 
          className={`absolute top-0 left-0 w-80 h-full bg-white shadow-2xl border-r border-zinc-100 transition-transform duration-300 ease-out flex flex-col ${uiState.menu ? 'translate-x-0' : '-translate-x-full'}`}
          onClick={e => e.stopPropagation()}
        >
          <div className="p-6 flex justify-between items-center border-b border-zinc-100">
            <h2 className="text-xl font-semibold tracking-tight text-zinc-950">{currentZone}</h2>
            <button onClick={() => setUiState({...uiState, menu: false})}><X className="w-5 h-5 text-zinc-500" /></button>
          </div>
          <div className="p-6 flex-1 flex flex-col gap-4">
            <button 
              onClick={() => {
                navigator.clipboard.writeText(`[INVITE] ${gameState.current.me.name}가 Meta버스로 초대합니다! https://metav.demo`);
                alert("초대 링크가 복사되었습니다!");
              }}
              className="w-full h-10 bg-zinc-900 text-white rounded-md font-medium text-sm flex items-center justify-center gap-2 transition hover:bg-zinc-800 active:scale-95 shadow"
            >
              <Copy className="w-4 h-4" /> 초대하기 (링크 복사)
            </button>
          </div>
          <div className="p-6 border-t border-zinc-100 mt-auto bg-zinc-50">
            <button className="w-full h-10 bg-white border border-zinc-200 text-zinc-600 rounded-md font-medium text-sm hover:bg-zinc-100 transition active:scale-95 shadow-sm">
              공간 나가기
            </button>
          </div>
        </div>
      </div>

      {/* 플레이어 명단 모달 */}
      <div className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-300 ${uiState.users ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black/20 backdrop-blur-xs" onClick={() => setUiState({...uiState, users: false})}></div>
        <div 
          className={`w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-zinc-100 transition-all duration-300 ease-out ${uiState.users ? 'scale-100' : 'scale-95'}`}
          onClick={e => e.stopPropagation()}
        >
          <div className="px-6 py-4 border-b border-zinc-100 flex justify-between items-center">
            <h3 className="text-lg font-semibold tracking-tight text-zinc-950">접속 중인 플레이어 (4)</h3>
            <button onClick={() => setUiState({...uiState, users: false})}><X className="w-5 h-5 text-zinc-500" /></button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-2 no-scrollbar space-y-1">
            {[gameState.current.me, ...gameState.current.dummies].map((user) => (
              <div key={user.id} className="flex items-center gap-3 p-3 hover:bg-zinc-100 rounded-xl transition">
                <div className="w-10 h-10 rounded-full flex items-center justify-center border border-zinc-200 bg-zinc-50 shadow-inner flex-shrink-0">
                  <User className="w-5 h-5 text-zinc-400" />
                </div>
                <span className="font-medium text-zinc-800 text-base">{user.name} {user.id === 'my-id' && <span className="text-sm text-sky-600 font-normal">[나]</span>}</span>
                <span className="ml-auto w-2.5 h-2.5 bg-sky-500 rounded-full border-2 border-white shadow"></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 프로필 수정 모달 */}
      <div className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-300 ${uiState.profile ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black/20 backdrop-blur-xs" onClick={() => setUiState({...uiState, profile: false})}></div>
        <div 
          className={`relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-zinc-100 p-8 flex flex-col items-center z-50 transition-all duration-300 ease-out ${uiState.profile ? 'scale-100' : 'scale-95'}`}
          onClick={e => e.stopPropagation()}
        >
          <button className="absolute top-5 right-5" onClick={() => setUiState({...uiState, profile: false})}><X className="w-5 h-5 text-zinc-500" /></button>
          
          <div className="w-24 h-24 rounded-full shadow-lg mb-8 border-4 border-white overflow-hidden ring-2 ring-zinc-100 flex items-center justify-center bg-[#ffedd5]">
            <canvas ref={canvasRef_profile} className="w-full h-full" style={{ imageRendering: 'pixelated' }} />
          </div>

          <div className="flex items-center gap-3 w-full">
            <input 
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              maxLength={9}
              className="flex-1 text-center h-12 text-xl font-semibold border-b-2 border-zinc-200 bg-white outline-none focus:border-sky-500 focus:bg-sky-50 transition tracking-tight"
            />
            <button 
              onClick={handleNameChange}
              className="w-12 h-12 bg-zinc-900 hover:bg-zinc-800 rounded-lg flex items-center justify-center shadow-md active:scale-95 transition"
            >
              <Check className="w-6 h-6 text-white" />
            </button>
          </div>
          <p className="text-zinc-500 text-sm mt-5 tracking-tight">최대 한글 6자 + 숫자 3자 조합</p>
        </div>
      </div>

    </div>
  );
}