import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center px-4 py-32 text-center">
      <p className="font-display text-6xl font-bold spectral-text">404</p>
      <p className="mt-4 text-fg-dim">お探しのページまたはデモは見つかりませんでした。</p>
      <Link to="/" className="btn btn-primary mt-6">
        ホームに戻る
      </Link>
    </div>
  );
}
