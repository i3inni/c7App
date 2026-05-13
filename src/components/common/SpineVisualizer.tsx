import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { G, Rect, Path, Circle, Text as SvgText } from 'react-native-svg';

export interface SpineAngles {
  c7: number;
  t3: number;
  t7: number;
}

export interface SpineRolls {
  c7: number;
  t3: number;
  t7: number;
}

type ZoneType = 'c7' | 't3' | 't7';

const WARN:   Record<ZoneType, number> = { c7: 8,  t3: 6,  t7: 10 };
const SEVERE: Record<ZoneType, number> = { c7: 14, t3: 11, t7: 15 };

const BASE_COLOR: Record<ZoneType, string> = {
  c7: '#4F46E5',
  t3: '#6366F1',
  t7: '#10B981',
};

function getColor(type: ZoneType, val: number): string {
  if (val >= SEVERE[type]) return '#F43F5E';
  if (val >= WARN[type])   return '#F97316';
  return BASE_COLOR[type];
}

// ── 척추 마디 ─────────────────────────────────────────
function VertebraElement({
  type, color, index, total,
}: {
  type: ZoneType; color: string; index: number; total: number;
}) {
  const scale  = 1.0 + (index / total) * 0.8;
  const width  = 34 * scale;
  const height = 16 * scale;

  let processPath = '';
  if (type === 'c7') {
    processPath = `M ${width/2-3} 0 Q ${width+6} 0 ${width+9} 5 L ${width+6} 8 Q ${width+3} 0 ${width/2-3} 3 Z`;
  } else if (type === 't3') {
    processPath = `M ${width/2-4} 0 Q ${width+10} 6 ${width+15} 16 L ${width+10} 19 Q ${width+6} 6 ${width/2-4} 3 Z`;
  } else {
    processPath = `M ${width/2-5} 0 Q ${width+12} 10 ${width+18} 24 L ${width+10} 27 Q ${width+8} 10 ${width/2-5} 3 Z`;
  }

  return (
    <G>
      <Rect
        x={-width / 2} y={-height / 2}
        width={width}   height={height}
        rx={height / 4}
        fill="#FFFFFF" stroke={color} strokeWidth="3.2"
      />
      <Path d={processPath} fill={color} fillOpacity={0.22} />
      <Rect
        x={-width / 2 + 8} y={height / 2 + 1}
        width={width - 16}  height={5 * scale}
        rx={2} fill={color} fillOpacity={0.6}
      />
    </G>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────
export default function SpineVisualizer({
  angles,
  rolls  = { c7: 0, t3: 0, t7: 0 },
  width  = 150,
  height = 300,
}: {
  angles: SpineAngles;
  rolls?:  SpineRolls;
  width?:  number;
  height?: number;
}) {
  const { points, labels } = useMemo(() => {
    const c7R = (angles.c7 * Math.PI) / 180;
    const t3R = (angles.t3 * Math.PI) / 180;
    const t7R = (angles.t7 * Math.PI) / 180;

    const cx       = 160;
    const yTop     = 60;
    const yBot     = 590;
    const SCALE    = 85;
    const SEGMENTS = 24;

    const gauss = (y: number, center: number, sigma: number) => {
      const d = (y - center) / sigma;
      return Math.exp(-0.5 * d * d);
    };

    const xAt = (y: number) =>
      cx
      + Math.sin(c7R) * SCALE * gauss(y, 140, 65)
      + Math.sin(t3R) * SCALE * gauss(y, 310, 80)
      + Math.sin(t7R) * SCALE * gauss(y, 495, 80);

    // 척추 마디 위치
    const pts: { x: number; y: number; angle: number; type: ZoneType; globalIdx: number }[] = [];
    for (let i = 0; i <= SEGMENTS; i++) {
      const y = yTop + (i / SEGMENTS) * (yBot - yTop);
      const x = xAt(y);
      const eps = 6;
      const ddx = xAt(y + eps) - xAt(y - eps);
      const ang = Math.atan2(2 * eps, ddx) * (180 / Math.PI);
      const type: ZoneType = y < 220 ? 'c7' : y < 400 ? 't3' : 't7';
      pts.push({ x, y, angle: ang, type, globalIdx: i });
    }

    // 라벨 위치: 각 구간 가우시안 중심에서의 실제 척추 x
    const lbls = (
      [
        { type: 'c7' as ZoneType, y: 140 },
        { type: 't3' as ZoneType, y: 310 },
        { type: 't7' as ZoneType, y: 495 },
      ] as { type: ZoneType; y: number }[]
    ).map(({ type, y }) => ({ type, y, x: xAt(y) }));

    return { points: pts, labels: lbls };
  }, [angles.c7, angles.t3, angles.t7]);

  const total = points.length - 1;

  return (
    <View style={s.wrap}>
      <Svg viewBox="0 0 320 640" width={width} height={height}>

        {/* 척추 마디 */}
        <G>
          {points.map((p, i) => (
            <G
              key={i}
              transform={`translate(${p.x.toFixed(2)},${p.y.toFixed(2)}) rotate(${(p.angle - 90).toFixed(2)})`}
            >
              <VertebraElement
                type={p.type}
                color={getColor(p.type, angles[p.type])}
                index={p.globalIdx}
                total={total}
              />
            </G>
          ))}
        </G>

        {/* 구간별 각도 라벨 — 실제 척추 위치 기준 왼쪽에 배치 */}
        {labels.map(({ type, x, y }) => {
          const val   = angles[type];
          const color = getColor(type, val);
          // 척추 왼쪽 끝에서 일정 간격 띄워 배치
          const labelX = x - 52;

          const rollVal = rolls[type];

          return (
            <G key={type}>
              <Circle cx={x - 36} cy={y} r={3} fill={color} />
              <SvgText
                x={labelX}
                y={y - 10}
                textAnchor="end"
                fill={color}
                fontSize="13"
                fontWeight="bold"
              >
                {type.toUpperCase()}
              </SvgText>
              {/* 전후(pitch) */}
              <SvgText x={labelX} y={y + 5} textAnchor="end" fill={color} fontSize="11">
                {`↕ ${val.toFixed(1)}°`}
              </SvgText>
              {/* 좌우(roll) */}
              <SvgText x={labelX} y={y + 18} textAnchor="end" fill={color} fontSize="11" opacity="0.7">
                {`↔ ${rollVal.toFixed(1)}°`}
              </SvgText>
            </G>
          );
        })}

      </Svg>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center' },
});
