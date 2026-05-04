// office-map — revisão 2026-05
import officeMap from "../public/sprites/office-map.json";

export const OFFICE_MAP = officeMap;
export const ROOMS = officeMap.rooms;
export const BASE_WIDTH = officeMap.imageSize.width;   // 1672
export const BASE_HEIGHT = officeMap.imageSize.height; // 941

export interface Room {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  navigationPoint: { x: number; y: number };
}

export function scaleRoom(room: Room, cw: number, ch: number) {
  const sx = cw / BASE_WIDTH;
  const sy = ch / BASE_HEIGHT;
  return {
    ...room,
    x: Math.round(room.x * sx),
    y: Math.round(room.y * sy),
    width: Math.round(room.width * sx),
    height: Math.round(room.height * sy),
    navigationPoint: {
      x: Math.round(room.navigationPoint.x * sx),
      y: Math.round(room.navigationPoint.y * sy),
    },
  };
}

export function getRoomById(id: string): Room | null {
  return (ROOMS as Room[]).find((r) => r.id === id) ?? null;
}

export function getNavigationPoint(roomId: string, cw: number, ch: number): { x: number; y: number } | null {
  const room = getRoomById(roomId);
  if (!room) return null;
  return scaleRoom(room, cw, ch).navigationPoint;
}

export function getRoomByPosition(x: number, y: number, cw: number, ch: number): Room | null {
  const sx = BASE_WIDTH / cw;
  const sy = BASE_HEIGHT / ch;
  const rx = x * sx;
  const ry = y * sy;
  return (ROOMS as Room[]).find(
    (r) => rx >= r.x && rx <= r.x + r.width && ry >= r.y && ry <= r.y + r.height
  ) ?? null;
}

export function getScaledRooms(cw: number, ch: number) {
  return (ROOMS as Room[]).map((r) => scaleRoom(r, cw, ch));
}
