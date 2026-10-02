"use client";

import { useSupportSettings } from "@/hooks/use-support-settings";

interface SupportInfoProps {
    type: "phone" | "email";
    linkType?: "tel" | "mailto" | "wa" | "none";
    className?: string;
    children?: React.ReactNode;
}

export function SupportInfo({ type, linkType = "none", className, children }: SupportInfoProps) {
    const { settings } = useSupportSettings();
    const value = type === "phone" ? settings.phone : settings.email;

    const content = children || value;

    if (linkType === "none") return <span className={className}>{content}</span>;

    let href = "";
    if (linkType === "tel") href = `tel:${value}`;
    if (linkType === "mailto") href = `mailto:${value}`;
    if (linkType === "wa") href = `https://wa.me/${value}`;

    return (
        <a href={href} className={className} dir={type === "phone" && !children ? "ltr" : undefined} target={linkType === "wa" ? "_blank" : undefined} rel={linkType === "wa" ? "noreferrer" : undefined}>
            {content}
        </a>
    );
}
