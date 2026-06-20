interface Props {
  text?: string;
}

export default function Loading({ text = '加载中...' }: Props) {
  return (
    <div className="loading-container">
      <div className="spinner" />
      <span className="loading-text">{text}</span>
    </div>
  );
}
