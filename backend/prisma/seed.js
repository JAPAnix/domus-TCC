import { prisma } from '../src/config/prisma.js';

const catalog = {
  'Limpeza e Serviços Domésticos': ['Diarista', 'Limpeza residencial', 'Limpeza pesada', 'Limpeza pós-obra', 'Limpeza de vidros', 'Limpeza de estofados', 'Limpeza de sofá', 'Limpeza de colchão', 'Limpeza de tapetes', 'Limpeza de piscina', 'Organização residencial', 'Passadeira', 'Cozinheira', 'Lavagem de roupas'],
  'Reformas e Construção': ['Pedreiro', 'Pintor', 'Gesseiro', 'Drywall', 'Azulejista', 'Instalador de pisos', 'Instalador de porcelanato', 'Instalador de laminado', 'Instalador de papel de parede', 'Telhadista', 'Calheiro', 'Impermeabilização', 'Serralheiro', 'Vidraceiro', 'Marceneiro', 'Carpinteiro', 'Marmorista'],
  'Elétrica': ['Eletricista residencial', 'Instalação de tomadas', 'Instalação de interruptores', 'Instalação de luminárias', 'Instalação de chuveiro', 'Instalação de ventilador de teto', 'Troca de disjuntor', 'Manutenção elétrica', 'Instalação de quadro elétrico'],
  'Hidráulica': ['Encanador', 'Reparo de vazamento', 'Instalação de torneira', 'Instalação de chuveiro', 'Instalação de vaso sanitário', 'Troca de sifão', "Limpeza de caixa d'água", 'Instalação hidráulica', 'Desentupimento'],
  'Ar-condicionado e Climatização': ['Instalação de ar-condicionado', 'Manutenção de ar-condicionado', 'Limpeza de ar-condicionado', 'Higienização de ar-condicionado', 'Recarga de gás', 'Instalação de ventilador', 'Manutenção de aquecedor'],
  'Eletrodomésticos': ['Conserto de geladeira', 'Conserto de freezer', 'Conserto de máquina de lavar', 'Conserto de secadora', 'Conserto de lava-louças', 'Conserto de micro-ondas', 'Conserto de forno', 'Conserto de fogão', 'Conserto de cooktop', 'Conserto de televisão'],
  'Informática e Tecnologia': ['Manutenção de computador', 'Manutenção de notebook', 'Formatação de computador', 'Instalação de Windows', 'Remoção de vírus', 'Upgrade de computador', 'Montagem de computador', 'Recuperação de dados', 'Instalação de impressora', 'Configuração de Wi-Fi', 'Instalação de roteador', 'Suporte técnico', 'Desenvolvimento de sites', 'Desenvolvimento Web', 'Desenvolvimento de sistemas', 'Desenvolvimento de aplicativos', 'Design gráfico', 'Criação de logotipo', 'Social media', 'Marketing digital'],
  'Segurança': ['Instalação de câmeras', 'Manutenção de câmeras', 'Instalação de alarme', 'Instalação de cerca elétrica', 'Instalação de interfone', 'Instalação de fechadura eletrônica', 'Instalação de vídeo porteiro', 'Segurança eletrônica'],
  'Jardinagem': ['Jardineiro', 'Manutenção de jardim', 'Corte de grama', 'Poda de árvores', 'Paisagismo', 'Limpeza de terreno', 'Plantio', 'Manutenção de plantas'],
  'Móveis': ['Montador de móveis', 'Desmontagem de móveis', 'Montagem de guarda-roupa', 'Montagem de cozinha', 'Instalação de prateleiras', 'Instalação de armários', 'Reparação de móveis', 'Marceneiro'],
  'Instalações': ['Instalação de TV', 'Instalação de suporte para TV', 'Instalação de cortinas', 'Instalação de persianas', 'Instalação de varal', 'Instalação de espelho', 'Instalação de quadros', 'Instalação de fechaduras', 'Instalação de telas de proteção', 'Instalação de redes de proteção'],
  'Mudanças e Transporte': ['Frete', 'Carreto', 'Mudança residencial', 'Mudança comercial', 'Transporte de móveis', 'Ajudante de mudança', 'Embalagem de mudança', 'Montagem e desmontagem para mudança'],
  'Automóveis': ['Mecânico', 'Eletricista automotivo', 'Troca de óleo', 'Troca de bateria', 'Funilaria', 'Pintura automotiva', 'Higienização automotiva', 'Lavagem automotiva', 'Instalação de som', 'Instalação de multimídia', 'Instalação de câmera de ré'],
  'Pets': ['Passeador de cães', 'Cuidador de pets', 'Pet sitter', 'Adestrador', 'Banho e tosa', 'Transporte de animais'],
  'Cuidados Pessoais': ['Cabeleireiro', 'Barbeiro', 'Manicure', 'Pedicure', 'Maquiador', 'Designer de sobrancelhas', 'Massagista'],
  'Eventos': ['Fotógrafo', 'Filmagem', 'DJ', 'Decoração de festas', 'Buffet', 'Garçom', 'Bartender', 'Segurança para eventos'],
  'Aulas': ['Professor particular', 'Reforço escolar', 'Professor de inglês', 'Professor de espanhol', 'Professor de matemática', 'Professor de português', 'Professor de informática', 'Professor de música', 'Personal trainer'],
  'Serviços Gerais': ['Marido de aluguel', 'Chaveiro', 'Dedetizador', 'Desentupidor', 'Instalador', 'Faz-tudo', 'Pequenos reparos residenciais'],
};

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function seed() {
  let total = 0;

  for (const [categoryName, serviceNames] of Object.entries(catalog)) {
    const category = await prisma.category.upsert({
      where: { name: categoryName },
      update: {},
      create: { name: categoryName },
    });

    for (const name of serviceNames) {
      await prisma.serviceCatalogItem.upsert({
        where: { categoryId_slug: { categoryId: category.id, slug: slugify(name) } },
        update: { active: true },
        create: { categoryId: category.id, name, slug: slugify(name), active: true },
      });
      total += 1;
    }
  }

  console.log(`Catálogo sincronizado: ${Object.keys(catalog).length} categorias e ${total} serviços.`);
}

seed()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
