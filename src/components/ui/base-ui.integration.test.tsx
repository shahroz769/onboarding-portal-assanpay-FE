// @vitest-environment jsdom
import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NavUser } from '../nav-user'

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }))
vi.mock('#/features/auth/auth-query', () => ({
  useLogoutMutation: () => ({ mutateAsync: vi.fn() }),
}))

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
} from './alert-dialog'
import { Avatar, AvatarFallback } from './avatar'
import { Badge } from './badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from './breadcrumb'
import { Button, ButtonLink } from './button'
import { Checkbox } from './checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './collapsible'
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from './combobox'
import { Dialog, DialogContent, DialogTitle } from './dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from './dropdown-menu'
import { Label } from './label'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { ScrollArea } from './scroll-area'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from './select'
import { Separator } from './separator'
import { Sheet, SheetContent, SheetTitle } from './sheet'
import { Sidebar, SidebarProvider, SidebarTrigger } from './sidebar'
import { Switch } from './switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip'

beforeAll(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
})

afterEach(cleanup)

it('opens the real account menu without a missing group context', async () => {
  render(
    <SidebarProvider>
      <NavUser
        user={{ name: 'Jane Doe', email: 'jane@example.com', avatar: '' }}
      />
    </SidebarProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: /Jane Doe/ }))
  expect(await screen.findByRole('menuitem', { name: 'Log out' })).toBeTruthy()
})

it('renders the account menu label and radio options in their required groups', async () => {
  render(
    <DropdownMenu open>
      <DropdownMenuTrigger>Account</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Jane Doe</DropdownMenuLabel>
          <DropdownMenuItem>Log out</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuGroup>
          <DropdownMenuRadioGroup value="light">
            <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>,
  )
  expect(await screen.findByText('Jane Doe')).toBeTruthy()
  expect(screen.getByText('Light')).toBeTruthy()
})

it('mounts open overlays and their context-dependent content', async () => {
  render(
    <>
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>Confirm</AlertDialogTitle>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open>
        <DialogContent>
          <DialogTitle>Details</DialogTitle>
        </DialogContent>
      </Dialog>
      <Sheet open>
        <SheetContent>
          <SheetTitle>Sidebar sheet</SheetTitle>
        </SheetContent>
      </Sheet>
      <Popover open>
        <PopoverTrigger>Popover trigger</PopoverTrigger>
        <PopoverContent>Popover body</PopoverContent>
      </Popover>
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger>Tooltip trigger</TooltipTrigger>
          <TooltipContent>Tooltip body</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </>,
  )
  expect(await screen.findByText('Confirm')).toBeTruthy()
  expect(screen.getByText('Details')).toBeTruthy()
  expect(screen.getByText('Sidebar sheet')).toBeTruthy()
  expect(screen.getByText('Popover body')).toBeTruthy()
  expect(screen.getByText('Tooltip body')).toBeTruthy()
})

it('mounts grouped select and a combobox list', async () => {
  render(
    <>
      <Select open items={[{ label: 'One', value: 'one' }]} value="one">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Numbers</SelectLabel>
            <SelectItem value="one">One</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <Combobox items={['Alpha']} open>
        <ComboboxInput />
        <ComboboxContent>
          <ComboboxList>
            <ComboboxItem value="Alpha">Alpha</ComboboxItem>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </>,
  )
  expect(await screen.findByText('Numbers')).toBeTruthy()
  expect(screen.getByText('Alpha')).toBeTruthy()
})

it('renders and interacts with the remaining migrated primitives', () => {
  render(
    <>
      <Avatar>
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
      <Badge>Status</Badge>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <Button>Submit</Button>
      <ButtonLink href="/cases">Cases</ButtonLink>
      <Checkbox aria-label="Accept" />
      <Collapsible>
        <CollapsibleTrigger>Expand</CollapsibleTrigger>
        <CollapsibleContent>Expanded content</CollapsibleContent>
      </Collapsible>
      <Label htmlFor="name">Name</Label>
      <input id="name" />
      <ScrollArea>
        <div>Scrollable content</div>
      </ScrollArea>
      <Separator />
      <SidebarProvider>
        <Sidebar collapsible="none">Navigation</Sidebar>
        <SidebarTrigger />
      </SidebarProvider>
      <Switch aria-label="Enabled" />
      <Tabs defaultValue="first">
        <TabsList>
          <TabsTrigger value="first">First</TabsTrigger>
          <TabsTrigger value="second">Second</TabsTrigger>
        </TabsList>
        <TabsContent value="first">First panel</TabsContent>
        <TabsContent value="second">Second panel</TabsContent>
      </Tabs>
    </>,
  )
  expect(screen.getByText('JD')).toBeTruthy()
  expect(screen.getByText('Scrollable content')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Expand' }))
  expect(screen.getByText('Expanded content')).toBeTruthy()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Accept' }))
  expect(
    screen
      .getByRole('checkbox', { name: 'Accept' })
      .getAttribute('aria-checked'),
  ).toBe('true')
  fireEvent.click(screen.getByRole('switch', { name: 'Enabled' }))
  expect(
    screen
      .getByRole('switch', { name: 'Enabled' })
      .getAttribute('aria-checked'),
  ).toBe('true')
  fireEvent.click(screen.getByRole('tab', { name: 'Second' }))
  expect(screen.getByText('Second panel')).toBeTruthy()
})
