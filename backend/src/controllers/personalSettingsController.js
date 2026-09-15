import { getPersonalSettings, savePersonalSettings } from '../services/personalSettingsService.js';
import { personalSchemas, contactTargetSchemas, codeSchema } from '../validators/personalSettingsValidator.js';
import { requestContactCode, confirmContactCode, cancelContactCode } from '../services/contactVerificationService.js';

export function personalError(res, error) {
  if (error.code === 'P2002') return res.status(409).json({ message: 'Este email ou telefone já está associado a outra conta.' });
  if (error.status) return res.status(error.status).json({ message: error.message });
  // Never log Prisma arguments, contact targets, or verification codes.
  console.error('Falha na operação de informações pessoais.');
  return res.status(500).json({ message: 'Não foi possível concluir a operação. Tente novamente.' });
}
function parse(schema, body, res) {
  const result = schema.safeParse(body);
  if (!result.success) {
    res.status(422).json({ message: result.error.issues[0].message, errors: result.error.issues.map((e) => ({ field: e.path.join('.'), message: e.message })) });
    return null;
  }
  return result.data;
}
export async function readPersonal(req, res) {
  try { res.set('Cache-Control', 'no-store').json(await getPersonalSettings(BigInt(req.user.id))); } catch (err) { personalError(res, err); }
}
export async function updatePersonal(req, res) {
  const schema = Object.hasOwn(personalSchemas, req.params.section) ? personalSchemas[req.params.section] : null;
  if (!schema) return res.status(404).json({ message: 'Seção não encontrada.' });
  const body = parse(schema, req.body, res);
  if (!body) return;
  try { res.json(await savePersonalSettings(BigInt(req.user.id), req.params.section, body)); } catch (err) { personalError(res, err); }
}
export async function contactAction(req, res) {
  const { type, action } = req.params;
  if (!['email', 'phone'].includes(type)) return res.status(404).json({ message: 'Tipo de confirmação inválido.' });
  try {
    const userId = BigInt(req.user.id);
    if (action === 'solicitar') {
      const body = parse(contactTargetSchemas[type], req.body, res);
      if (!body) return;
      return res.status(201).json(await requestContactCode(userId, type, body.target));
    }
    if (action === 'confirmar') {
      const body = parse(codeSchema, req.body, res);
      if (!body) return;
      await confirmContactCode(userId, type, body.code);
    } else if (action === 'cancelar') await cancelContactCode(userId, type);
    else return res.status(404).json({ message: 'Operação não encontrada.' });
    res.json(await getPersonalSettings(userId));
  } catch (err) { personalError(res, err); }
}
