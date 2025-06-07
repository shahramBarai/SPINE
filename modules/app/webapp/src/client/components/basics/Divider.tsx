export function Divider({ text }: { text: string }) {
  return (
    <div className="relative mt-6">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center text-sm">
        <span className="px-2 bg-background text-muted-foreground">{text}</span>
      </div>
    </div>
  );
}
