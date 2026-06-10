import { prisma } from '../config/prisma.js';

const roleMiddleware = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      const userId = BigInt(req.user.id);

      const userWithRoles = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          roles: {
            select: {
              role: {
                select: { name: true }
              }
            }
          }
        }
      });

      if (!userWithRoles) {
        return res.status(401).json({ message: 'Usuário não encontrado' });
      }

      const userRoles = userWithRoles.roles.map(ur => ur.role.name);

      const hasRole = allowedRoles.some(role => userRoles.includes(role));
      if (!hasRole) {
        return res.status(403).json({ message: 'Acesso negado' });
      }

      req.roles = userRoles;
      next();
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  };
};

export default roleMiddleware;