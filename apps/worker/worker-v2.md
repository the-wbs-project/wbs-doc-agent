
I want you to create a new Cloudflare Worker with completely different behavior than the last. Now the AI workflow is build in n8n and the Worker is the man in the middle.

- Create this under the folder worker2. I will be during off the first so don't expect both to be running.
- When a file is uploaded, a job ID is created and an instance of a durable object is created.
- This durable object is EVERYTHING about that job. It
    - Handles artifacts
    - Handles status
    - Handles HITL questions
- The object will also store this information in R2. Each status update is appended to the end of status.json. Same for questions.json. 
- Updates will be sent to the DO from n8n, not the other way around. The only time the worker will contact the n8n message is to:
    - Start the workflow
    - Send back answers via the workflow's webhook.
- The site will be updated based on the data in the DO. If sockets make sense use them, if not use standard API calls.
- I have included the folder "r2-wrapper". Use this as a template for R2 storage (but we won't be keeping this folder around so don't ACTUALLY plan on using it beyond initial development).
