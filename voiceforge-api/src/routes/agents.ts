import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createAgentSchema, updateAgentSchema, type CreateAgentInput, type UpdateAgentInput } from '../validators/agent.validator';
import { Agent, UserKnowledgeContext } from '../db';
import { buildAgentKnowledgeFile } from '../services/contextBuilder.service';
import { createVapiAssistant, updateVapiAssistant, deleteVapiAssistant } from '../services/vapi.service';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// GET /agents - List all agents for user
router.get('/', async (req, res, next) => {
  try {
    const agents = await Agent.find({ userId: req.user!.userId })
      .sort({ createdAt: -1 });
    res.json({ agents });
  } catch (err) {
    next(err);
  }
});

// POST /agents - Create new agent
router.post('/', validate(createAgentSchema), async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const body = req.body as CreateAgentInput;

    // 1. Create Agent in MongoDB
    const agent = await Agent.create({
      userId,
      ...body,
      knowledgeFile: undefined,
      knowledgeFileGeneratedAt: undefined
    });

    // 2. Generate agent-specific context using agent inputs + user-level context
    const userContext = await UserKnowledgeContext.findOne({ userId });
    const agentContext = await buildAgentKnowledgeFile({
      agentType: body.agentType,
      description: body.description,
      callObjective: body.callObjective,
      userContext: userContext?.knowledgeFile as any
    });
    agent.knowledgeFile = agentContext;
    agent.knowledgeFileGeneratedAt = new Date();
    await agent.save();

    // 3. Create Vapi assistant
    try {
      const vapiId = await createVapiAssistant(agent);
      agent.vapiAgentId = vapiId;
      await agent.save();
    } catch (err) {
      console.error('Failed to create Vapi assistant:', err);
      // Continue - user can retry or we can have a background job
    }

    res.status(201).json({ agent });
  } catch (err) {
    next(err);
  }
});

// GET /agents/:id - Get single agent
router.get('/:id', async (req, res, next) => {
  try {
    const agent = await Agent.findById(req.params.id);

    if (!agent) {
      throw new AppError('Agent not found', 404);
    }

    if (agent.userId.toString() !== req.user!.userId) {
      throw new AppError('Forbidden', 403);
    }

    res.json({ agent });
  } catch (err) {
    next(err);
  }
});

// PATCH /agents/:id - Update agent
router.patch('/:id', validate(updateAgentSchema), async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const body = req.body as UpdateAgentInput;

    const agent = await Agent.findById(req.params.id);

    if (!agent) {
      throw new AppError('Agent not found', 404);
    }

    if (agent.userId.toString() !== userId) {
      throw new AppError('Forbidden', 403);
    }

    // Update fields
    Object.assign(agent, body);

    // If description or callObjective changed, regenerate knowledge file
    if (body.description || body.callObjective) {
      console.log('Regenerating knowledge file...');
      try {
        const userContext = await UserKnowledgeContext.findOne({ userId });
        const knowledgeFile = await buildAgentKnowledgeFile({
          agentType: agent.agentType,
          description: body.description ?? agent.description,
          callObjective: body.callObjective ?? agent.callObjective,
          userContext: userContext?.knowledgeFile as any
        });
        agent.knowledgeFile = knowledgeFile;
        agent.knowledgeFileGeneratedAt = new Date();
      } catch (err) {
        console.error('Failed to regenerate knowledge file:', err);
      }
    }

    await agent.save();

    // If voiceId changed, update Vapi assistant
    if (body.voiceId && agent.vapiAgentId) {
      try {
        await updateVapiAssistant(agent.vapiAgentId, { voiceId: body.voiceId });
      } catch (err) {
        console.error('Failed to update Vapi assistant:', err);
      }
    }

    res.json({ agent });
  } catch (err) {
    next(err);
  }
});

// DELETE /agents/:id - Delete agent
router.delete('/:id', async (req, res, next) => {
  try {
    const agent = await Agent.findById(req.params.id);

    if (!agent) {
      throw new AppError('Agent not found', 404);
    }

    if (agent.userId.toString() !== req.user!.userId) {
      throw new AppError('Forbidden', 403);
    }

    // Delete Vapi assistant (ignore 404)
    if (agent.vapiAgentId) {
      try {
        await deleteVapiAssistant(agent.vapiAgentId);
      } catch (err) {
        console.error('Failed to delete Vapi assistant:', err);
      }
    }

    await Agent.findByIdAndDelete(req.params.id);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /agents/:id/regenerate-context - Manual knowledge file regeneration
router.get('/:id/regenerate-context', async (req, res, next) => {
  try {
    const userId = req.user!.userId;

    const agent = await Agent.findById(req.params.id);

    if (!agent) {
      throw new AppError('Agent not found', 404);
    }

    if (agent.userId.toString() !== userId) {
      throw new AppError('Forbidden', 403);
    }

    const userContext = await UserKnowledgeContext.findOne({ userId });
    const knowledgeFile = await buildAgentKnowledgeFile({
      agentType: agent.agentType,
      description: agent.description,
      callObjective: agent.callObjective,
      userContext: userContext?.knowledgeFile as any
    });
    agent.knowledgeFile = knowledgeFile;
    agent.knowledgeFileGeneratedAt = new Date();
    await agent.save();

    res.json({ success: true, knowledgeFile });
  } catch (err) {
    next(err);
  }
});

export default router;
