export function EmptyState({ icon: Icon, title, description, className }) {
    return (
        <div className={`flex flex-col items-center justify-center py-12 text-center ${className ?? ''}`}>
            {Icon && (
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Icon className="h-8 w-8 text-muted-foreground" />
                </div>
            )}
            {title && <p className="font-medium">{title}</p>}
            {description && (
                <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
        </div>
    );
}
