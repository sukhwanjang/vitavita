import Board from '../components/board';

// 출력 전용 화면 — 출력대기만 크게 (출력 내리는 컴퓨터용, 좁은 창에 최적화)
export default function QueuePage() {
  return <Board only="queue" />;
}
