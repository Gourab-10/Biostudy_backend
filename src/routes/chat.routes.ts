// src/routes/chat.routes.ts
// ─── AI Bio Mentor Chat Routes ───
// GET    /api/chat           → Get chat history
// POST   /api/chat           → Send a message (and get AI response)
// DELETE /api/chat           → Clear chat history

import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// All chat routes require authentication
router.use(authenticate);

// ═══════════════════════════════════════════
// Get Chat History
// ═══════════════════════════════════════════

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const messages = await prisma.chatMessage.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ messages });
  } catch (error: any) {
    console.error('[Chat] Get history error:', error);
    res.status(500).json({ error: 'Failed to fetch chat history.' });
  }
});

// ═══════════════════════════════════════════
// Send Message & Get AI Response
// ═══════════════════════════════════════════

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { text, time } = req.body;

    if (!text) {
      res.status(400).json({ error: 'text is required.' });
      return;
    }

    const messageTime = time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    // Save user message
    const userMessage = await prisma.chatMessage.create({
      data: {
        userId: req.userId!,
        text,
        sender: 'user',
        time: messageTime,
      },
    });

    // Generate AI response (keyword-based, matching existing Firestore logic)
    const aiResponse = generateBioResponse(text);
    const aiTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    // Save AI message
    const aiMessage = await prisma.chatMessage.create({
      data: {
        userId: req.userId!,
        text: aiResponse,
        sender: 'ai',
        time: aiTime,
      },
    });

    res.json({
      userMessage,
      aiMessage,
    });
  } catch (error: any) {
    console.error('[Chat] Send message error:', error);
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

// ═══════════════════════════════════════════
// Clear Chat History
// ═══════════════════════════════════════════

router.delete('/', async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.chatMessage.deleteMany({
      where: { userId: req.userId },
    });

    res.json({ message: 'Chat history cleared.' });
  } catch (error: any) {
    console.error('[Chat] Clear history error:', error);
    res.status(500).json({ error: 'Failed to clear chat history.' });
  }
});

// ═══════════════════════════════════════════
// Keyword-Based AI Response Generator
// ═══════════════════════════════════════════

function generateBioResponse(userText: string): string {
  const lower = userText.toLowerCase();

  const responses: Record<string, string> = {
    mitochondria:
      '🔬 Mitochondria are the "powerhouses of the cell." They generate most of the cell\'s supply of adenosine triphosphate (ATP) through oxidative phosphorylation. They have their own DNA (mtDNA) and are believed to have originated from an ancient symbiotic relationship (endosymbiotic theory).',
    cell: '🧬 The cell is the basic structural and functional unit of all living organisms. Cells can be prokaryotic (without a nucleus, like bacteria) or eukaryotic (with a nucleus, like plant and animal cells). Key organelles include the nucleus, mitochondria, endoplasmic reticulum, and Golgi apparatus.',
    photosynthesis:
      '🌿 Photosynthesis is the process by which green plants, algae, and some bacteria convert light energy into chemical energy (glucose). The overall equation is: 6CO₂ + 6H₂O + Light Energy → C₆H₁₂O₆ + 6O₂. It occurs in two stages: the Light Reactions (in thylakoids) and the Calvin Cycle (in stroma).',
    dna: '🧬 DNA (Deoxyribonucleic Acid) is the hereditary material in almost all organisms. It has a double helix structure discovered by Watson and Crick. DNA is made of nucleotides, each containing a phosphate group, a deoxyribose sugar, and a nitrogenous base (A, T, G, C). The sequence of bases encodes genetic information.',
    rna: '📋 RNA (Ribonucleic Acid) is essential for protein synthesis. There are three main types: mRNA (carries genetic code from DNA to ribosomes), tRNA (brings amino acids during translation), and rRNA (forms ribosomes). Unlike DNA, RNA is single-stranded and uses uracil instead of thymine.',
    enzyme:
      '⚡ Enzymes are biological catalysts — proteins that speed up chemical reactions without being consumed. They work by lowering activation energy. Key concepts: lock-and-key model, induced fit model, active site, substrate specificity, and factors affecting activity (temperature, pH, concentration).',
    evolution:
      '🌍 Evolution is the change in inherited characteristics of biological populations over successive generations. Key mechanisms: Natural Selection (Darwin), Genetic Drift, Gene Flow, and Mutation. Evidence includes fossil records, comparative anatomy, molecular biology, and biogeography.',
    genetics:
      '🧬 Genetics is the study of heredity. Key concepts include: Mendel\'s Laws (segregation, independent assortment), dominant/recessive alleles, genotype vs phenotype, Punnett squares, codominance, incomplete dominance, sex-linked traits, and polygenic inheritance.',
    ecology:
      '🌎 Ecology studies interactions between organisms and their environment. Key concepts: ecosystems, food chains/webs, trophic levels, energy flow, nutrient cycling, biomes, population dynamics, biodiversity, and conservation biology.',
    protein:
      '🔬 Proteins are large biomolecules made of amino acids linked by peptide bonds. They have four levels of structure: primary (sequence), secondary (alpha helix, beta sheet), tertiary (3D folding), and quaternary (multiple subunits). Proteins serve as enzymes, structural components, hormones, and antibodies.',
  };

  for (const [keyword, response] of Object.entries(responses)) {
    if (lower.includes(keyword)) {
      return response;
    }
  }

  return '🤔 Great question! I\'m your Bio Mentor, and I specialize in biology topics. Try asking me about cells, DNA, photosynthesis, mitochondria, enzymes, evolution, genetics, ecology, proteins, or RNA. I\'ll give you detailed, exam-ready explanations!';
}

export default router;
