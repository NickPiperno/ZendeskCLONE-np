import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/ui/components/dialog"
import { Button } from "@/ui/components/button"
import { NewTicketForm } from "./NewTicketForm"
import { useState } from "react"

/**
 * Dialog component for creating new tickets
 * Opens in a modal overlay
 */
export function NewTicketDialog() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New Ticket</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Ticket</DialogTitle>
          <DialogDescription>
            Fill out the form below to create a new support ticket.
          </DialogDescription>
        </DialogHeader>
        <NewTicketForm
          onSuccess={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
} 