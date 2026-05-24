export function CallBackground() {
  return (
    <>
      <div className="absolute inset-0 gradient-mesh opacity-30" />
      <div className="absolute top-1/4 -left-32 w-64 h-64 rounded-full bg-primary/20 blur-3xl animate-pulse" />
      <div
        className="absolute bottom-1/4 -right-32 w-64 h-64 rounded-full bg-accent/20 blur-3xl animate-pulse"
        style={{ animationDelay: '1s' }}
      />
    </>
  );
}
