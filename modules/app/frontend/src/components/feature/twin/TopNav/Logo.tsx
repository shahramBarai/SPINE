function Logo() {
    return (
        <div className="flex items-center gap-2.5 pr-4 border-r border-border/60 h-full">
            <img
                src="/md2mv-logo.png"
                alt="MD2MV logo"
                className="h-8 w-8 rounded object-cover"
            />
            <div className="leading-tight">
                <div className="font-semibold tracking-tight text-sm">
                    MD<span className="text-primary">2MV</span>
                </div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-mono">
                    Command Center
                </div>
            </div>
        </div>
    );
}

export { Logo };
