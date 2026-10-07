'use client';

import * as React from 'react';
import { X } from 'lucide-react';

import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';

// Renders as a centered Dialog on desktop and a bottom-sheet Drawer on mobile,
// so existing forms/content inside don't need to change — only the shell does.
const MOBILE_QUERY = '(max-width: 767px)';

const ResponsiveDialog = (props: React.ComponentProps<typeof Dialog>) => {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const Comp = isMobile ? Drawer : Dialog;
  return <Comp {...props} />;
};

const ResponsiveDialogTrigger = React.forwardRef<
  React.ElementRef<typeof DialogTrigger>,
  React.ComponentPropsWithoutRef<typeof DialogTrigger>
>((props, ref) => {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const Comp = isMobile ? DrawerTrigger : DialogTrigger;
  return <Comp ref={ref} {...props} />;
});
ResponsiveDialogTrigger.displayName = 'ResponsiveDialogTrigger';

const ResponsiveDialogClose = React.forwardRef<
  React.ElementRef<typeof DialogClose>,
  React.ComponentPropsWithoutRef<typeof DialogClose>
>((props, ref) => {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const Comp = isMobile ? DrawerClose : DialogClose;
  return <Comp ref={ref} {...props} />;
});
ResponsiveDialogClose.displayName = 'ResponsiveDialogClose';

const ResponsiveDialogContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DialogContent> & {
    /** Extra className applied only when rendered as the mobile Drawer. */
    drawerClassName?: string;
  }
>(({ className, drawerClassName, children, ...props }, ref) => {
  const isMobile = useMediaQuery(MOBILE_QUERY);

  if (isMobile) {
    return (
      <DrawerContent
        className={cn('max-h-[90vh]', drawerClassName)}
        {...(props as React.ComponentPropsWithoutRef<typeof DrawerContent>)}
      >
        <DrawerClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DrawerClose>
        <div className="overflow-y-auto px-4 pb-6">{children}</div>
      </DrawerContent>
    );
  }

  return (
    <DialogContent ref={ref} className={className} {...props}>
      {children}
    </DialogContent>
  );
});
ResponsiveDialogContent.displayName = 'ResponsiveDialogContent';

const ResponsiveDialogHeader = (props: React.HTMLAttributes<HTMLDivElement>) => {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const Comp = isMobile ? DrawerHeader : DialogHeader;
  return <Comp {...props} />;
};

const ResponsiveDialogFooter = (props: React.HTMLAttributes<HTMLDivElement>) => {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const Comp = isMobile ? DrawerFooter : DialogFooter;
  return <Comp {...props} />;
};

const ResponsiveDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogTitle>,
  React.ComponentPropsWithoutRef<typeof DialogTitle>
>((props, ref) => {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const Comp = isMobile ? DrawerTitle : DialogTitle;
  return <Comp ref={ref} {...props} />;
});
ResponsiveDialogTitle.displayName = 'ResponsiveDialogTitle';

const ResponsiveDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogDescription>,
  React.ComponentPropsWithoutRef<typeof DialogDescription>
>((props, ref) => {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const Comp = isMobile ? DrawerDescription : DialogDescription;
  return <Comp ref={ref} {...props} />;
});
ResponsiveDialogDescription.displayName = 'ResponsiveDialogDescription';

export {
  ResponsiveDialog,
  ResponsiveDialogTrigger,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogFooter,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
};
