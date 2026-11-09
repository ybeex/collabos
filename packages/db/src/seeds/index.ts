import { db } from '../client'
import { nanoid } from 'nanoid'
import argon2 from 'argon2'

async function seed() {
  console.log('Seeding database...')

  // Clean slate for development
  if (process.env['NODE_ENV'] !== 'production') {
    await db.workGraphEdge.deleteMany()
    await db.workGraphNode.deleteMany()
    await db.auditLog.deleteMany()
    await db.taskComment.deleteMany()
    await db.task.deleteMany()
    await db.canvasNode.deleteMany()
    await db.canvas.deleteMany()
    await db.documentVersion.deleteMany()
    await db.documentBlock.deleteMany()
    await db.document.deleteMany()
    await db.messageReaction.deleteMany()
    await db.message.deleteMany()
    await db.thread.deleteMany()
    await db.channelMember.deleteMany()
    await db.channel.deleteMany()
    await db.workspaceMember.deleteMany()
    await db.workspace.deleteMany()
    await db.user.deleteMany()
    console.log('Cleaned existing data')
  }

  const passwordHash = await argon2.hash('password123', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  })

  // Create seed users
  const alice = await db.user.create({
    data: {
      id: nanoid(21),
      email: 'alice@example.com',
      name: 'Alice Chen',
      passwordHash,
      plan: 'pro',
      timezone: 'America/New_York',
    },
  })

  const bob = await db.user.create({
    data: {
      id: nanoid(21),
      email: 'bob@example.com',
      name: 'Bob Kumar',
      passwordHash,
      plan: 'pro',
      timezone: 'Europe/London',
    },
  })

  const carol = await db.user.create({
    data: {
      id: nanoid(21),
      email: 'carol@example.com',
      name: 'Carol Zhang',
      passwordHash,
      plan: 'free',
      timezone: 'Asia/Tokyo',
    },
  })

  // Super admin dashboard feature: a platform-level operator account.
  // Deliberately NOT added as a member of acme-corp below — the whole
  // point of isSuperAdmin being independent of WorkspaceMember.role is
  // that platform authority requires no workspace membership at all.
  // Seeding it outside the workspace makes that separation visible in
  // local dev data, not just in code comments.
  const dana = await db.user.create({
    data: {
      id: nanoid(21),
      email: 'dana@collabos.io',
      name: 'Dana Osei',
      passwordHash,
      plan: 'enterprise',
      timezone: 'UTC',
      isSuperAdmin: true,
    },
  })

  console.log(`Created users: ${[alice, bob, carol].map((u) => u.email).join(', ')}`)

  // Create workspace
  const workspace = await db.workspace.create({
    data: {
      id: nanoid(21),
      name: 'Acme Corp',
      slug: 'acme-corp',
      description: 'The Acme Corp product team workspace',
      plan: 'pro',
      ownerId: alice.id,
    },
  })

  // Add all users as workspace members
  await db.workspaceMember.createMany({
    data: [
      { id: nanoid(21), workspaceId: workspace.id, userId: alice.id, role: 'owner', status: 'active' },
      { id: nanoid(21), workspaceId: workspace.id, userId: bob.id, role: 'admin', status: 'active' },
      { id: nanoid(21), workspaceId: workspace.id, userId: carol.id, role: 'member', status: 'active' },
    ],
  })

  // Create channels
  const generalChannel = await db.channel.create({
    data: {
      id: nanoid(21),
      workspaceId: workspace.id,
      name: 'general',
      description: 'Company-wide announcements',
      type: 'public',
      createdById: alice.id,
    },
  })

  const productChannel = await db.channel.create({
    data: {
      id: nanoid(21),
      workspaceId: workspace.id,
      name: 'product',
      description: 'Product discussions and decisions',
      type: 'public',
      createdById: alice.id,
    },
  })

  const engineeringChannel = await db.channel.create({
    data: {
      id: nanoid(21),
      workspaceId: workspace.id,
      name: 'engineering',
      description: 'Engineering team',
      type: 'public',
      createdById: bob.id,
    },
  })

  // Add channel members
  const channelMemberData = [
    ...[generalChannel, productChannel, engineeringChannel].flatMap((ch) =>
      [alice, bob, carol].map((u) => ({
        id: nanoid(21),
        channelId: ch.id,
        userId: u.id,
        role: u.id === alice.id ? 'admin' : 'member',
      })),
    ),
  ]

  await db.channelMember.createMany({ data: channelMemberData })

  // Seed messages
  const messages = [
    { channelId: generalChannel.id, authorId: alice.id, content: 'Welcome to CollabOS! This is our new unified workspace.' },
    { channelId: generalChannel.id, authorId: bob.id, content: 'Excited to finally have everything in one place. No more switching between Slack and Notion!' },
    { channelId: generalChannel.id, authorId: carol.id, content: 'The canvas feature looks amazing. Can we use it for our next sprint planning?' },
    { channelId: productChannel.id, authorId: alice.id, content: 'We need to decide on the pricing model for Q3. I am thinking usage-based tiers.' },
    { channelId: productChannel.id, authorId: bob.id, content: 'Agreed. I will create a task to research competitor pricing and put together a doc.' },
    { channelId: engineeringChannel.id, authorId: bob.id, content: 'Auth API is done and deployed. Should we move the deploy deadline to Friday?' },
    { channelId: engineeringChannel.id, authorId: carol.id, content: 'Friday works for me. I will update the milestone.' },
  ]

  for (const msg of messages) {
    await db.message.create({ data: { id: nanoid(21), ...msg } })
  }

  // Create a project and tasks
  const project = await db.project.create({
    data: {
      id: nanoid(21),
      workspaceId: workspace.id,
      name: 'Q3 Launch',
      description: 'Q3 product launch milestones',
      color: '#e8400a',
    },
  })

  await db.task.createMany({
    data: [
      {
        id: nanoid(21),
        workspaceId: workspace.id,
        projectId: project.id,
        title: 'Design onboarding flow',
        status: 'done',
        priority: 'high',
        assigneeId: carol.id,
        createdById: alice.id,
      },
      {
        id: nanoid(21),
        workspaceId: workspace.id,
        projectId: project.id,
        title: 'Build auth API',
        status: 'done',
        priority: 'urgent',
        assigneeId: bob.id,
        createdById: alice.id,
      },
      {
        id: nanoid(21),
        workspaceId: workspace.id,
        projectId: project.id,
        title: 'Implement pricing page',
        status: 'in_progress',
        priority: 'high',
        assigneeId: carol.id,
        createdById: alice.id,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
      {
        id: nanoid(21),
        workspaceId: workspace.id,
        projectId: project.id,
        title: 'Set up monitoring and alerting',
        status: 'todo',
        priority: 'medium',
        assigneeId: bob.id,
        createdById: alice.id,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      {
        id: nanoid(21),
        workspaceId: workspace.id,
        projectId: project.id,
        title: 'Write API documentation',
        status: 'todo',
        priority: 'low',
        createdById: alice.id,
      },
    ],
  })

  // Create a seed document
  const doc = await db.document.create({
    data: {
      id: nanoid(21),
      workspaceId: workspace.id,
      title: 'Q3 Pricing Strategy',
      createdById: alice.id,
      lastEditedById: alice.id,
    },
  })

  await db.documentBlock.createMany({
    data: [
      {
        id: nanoid(21),
        documentId: doc.id,
        type: 'heading1',
        content: { text: 'Q3 Pricing Strategy' },
        order: 0,
      },
      {
        id: nanoid(21),
        documentId: doc.id,
        type: 'paragraph',
        content: { text: 'This document outlines our pricing model for Q3 launch. We are exploring usage-based tiers with a generous free tier for viral growth.' },
        order: 1,
      },
      {
        id: nanoid(21),
        documentId: doc.id,
        type: 'heading2',
        content: { text: 'Proposed Tiers' },
        order: 2,
      },
      {
        id: nanoid(21),
        documentId: doc.id,
        type: 'bulleted_list',
        content: { text: 'Free: Up to 3 members, 90-day history, no AI' },
        order: 3,
      },
      {
        id: nanoid(21),
        documentId: doc.id,
        type: 'bulleted_list',
        content: { text: 'Pro ($12/user/mo): Unlimited members, AI features, unlimited history' },
        order: 4,
      },
      {
        id: nanoid(21),
        documentId: doc.id,
        type: 'bulleted_list',
        content: { text: 'Business ($24/user/mo): Automations, AI agents, admin controls' },
        order: 5,
      },
    ],
  })

  // Create a canvas
  const canvas = await db.canvas.create({
    data: {
      id: nanoid(21),
      workspaceId: workspace.id,
      name: 'Sprint Planning Board',
    },
  })

  await db.canvasNode.createMany({
    data: [
      { id: nanoid(21), canvasId: canvas.id, type: 'sticky', content: { text: 'Improve onboarding', color: '#fde8e5' }, x: 100, y: 100, width: 200, height: 120 },
      { id: nanoid(21), canvasId: canvas.id, type: 'sticky', content: { text: 'Add canvas templates', color: '#e3f4ec' }, x: 350, y: 100, width: 200, height: 120 },
      { id: nanoid(21), canvasId: canvas.id, type: 'sticky', content: { text: 'Launch pricing page', color: '#e8eeff' }, x: 600, y: 100, width: 200, height: 120 },
      { id: nanoid(21), canvasId: canvas.id, type: 'shape', content: { shape: 'rectangle', label: 'Q3 Sprint' }, x: 80, y: 60, width: 760, height: 210 },
    ],
  })

  console.log(`
Seed complete.

Login credentials:
  alice@example.com / password123  (Pro plan, Owner)
  bob@example.com / password123    (Pro plan, Admin)
  carol@example.com / password123  (Free plan, Member)
  dana@collabos.io / password123   (Super Admin — platform-wide, not a member of any workspace)

Workspace slug: acme-corp
  `)
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
