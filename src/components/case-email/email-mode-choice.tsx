import {
  addTransitionType,
  startTransition,
  useLayoutEffect,
  useRef,
  useState,
  ViewTransition,
} from 'react'
import type { ReactNode } from 'react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { skipActiveViewTransition } from '#/lib/view-transition'
import type { EmailSendingMode } from '#/schemas/configuration.schema'

interface EmailModeChoiceProps {
  mode: EmailSendingMode
  autoContent: ReactNode
  manualContent: ReactNode
  whatsappContent?: ReactNode
}

type ModeTab = {
  value: string
  label: string
  content: ReactNode
}

export function EmailModeChoice({
  mode,
  autoContent,
  manualContent,
  whatsappContent,
}: EmailModeChoiceProps) {
  const enabledTabs = [
    mode.autoEnabled
      ? { value: 'auto', label: 'Auto (Resend)', content: autoContent }
      : null,
    mode.manualEnabled
      ? { value: 'manual', label: 'Manual (Gmail)', content: manualContent }
      : null,
    whatsappContent
      ? { value: 'whatsapp', label: 'WhatsApp', content: whatsappContent }
      : null,
  ].filter((tab): tab is ModeTab => Boolean(tab))

  const [activeValue, setActiveValue] = useState(enabledTabs[0]?.value)
  const activeTab =
    enabledTabs.find((tab) => tab.value === activeValue) ?? enabledTabs[0]

  if (enabledTabs.length > 1 && activeTab) {
    return (
      <Tabs
        value={activeTab.value}
        onValueChange={(value) => {
          const from = enabledTabs.indexOf(activeTab)
          const to = enabledTabs.findIndex((tab) => tab.value === value)
          if (to < 0 || to === from) return
          // Same motion as the case side panel tabs: the panel slides toward
          // the picked tab. Own transition types, since these dialogs can
          // render inside the side panel's tab-next/tab-prev ViewTransition.
          skipActiveViewTransition()
          startTransition(() => {
            addTransitionType(to > from ? 'mode-tab-next' : 'mode-tab-prev')
            setActiveValue(enabledTabs[to].value)
          })
        }}
      >
        <TabsList
          className="grid w-full"
          style={{
            gridTemplateColumns: `repeat(${enabledTabs.length}, minmax(0, 1fr))`,
          }}
        >
          {enabledTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <AutoHeight>
          <ViewTransition
            default="none"
            update={{
              'mode-tab-next': 'vt-slide vt-quick vt-clip vt-forward',
              'mode-tab-prev': 'vt-slide vt-quick vt-clip vt-back',
              default: 'none',
            }}
          >
            <div>
              {enabledTabs.map((tab) => (
                <TabsContent key={tab.value} value={tab.value} className="pt-4">
                  {tab.content}
                </TabsContent>
              ))}
            </div>
          </ViewTransition>
        </AutoHeight>
      </Tabs>
    )
  }

  return <>{enabledTabs[0]?.content ?? null}</>
}

/**
 * Glides the dialog to its content's height instead of jumping, when the tab
 * or its contents (e.g. a loaded preview) change. Timed like the vt-quick
 * panel slide so the dialog edge tracks the sliding panel. Height is written
 * straight from the ResizeObserver so it starts on the same frame as the
 * slide; the first measurement is applied without a transition.
 */
function AutoHeight({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return
    outer.style.height = `${inner.offsetHeight}px`
    const frame = requestAnimationFrame(() => {
      outer.dataset.ready = ''
    })
    const observer = new ResizeObserver(() => {
      outer.style.height = `${inner.offsetHeight}px`
    })
    observer.observe(inner)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  return (
    // Padding + negative margin leave room for focus rings at the edges.
    <div
      ref={outerRef}
      className="-mx-1 -mb-1 overflow-clip px-1 data-ready:transition-[height] data-ready:duration-210 data-ready:ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
    >
      <div ref={innerRef} className="flow-root pb-1">
        {children}
      </div>
    </div>
  )
}
