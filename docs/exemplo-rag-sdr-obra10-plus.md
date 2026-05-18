# Obra10+ — Documento de conhecimento comercial (exemplo para RAG / SDR)

*Documento fictício de exemplo para testes de embeddings. Ajuste valores, CNPJ e ofertas reais antes de usar em produção.*

---

## 1. Visão do negócio

**Obra10+** é um ecossistema digital voltado ao **setor da construção civil, reformas e operações ligadas a obras** no Brasil. A proposta é **organizar o relacionamento com leads, fornecedores e parceiros**, dando visibilidade a **CRM, ciclos de IA (copiloto), integrações de canal (ex.: WhatsApp)** e **bases de conhecimento** para agentes que apoiam times comerciais e de operações.

**Missão (trabalho):** reduzir atrito entre **demanda** (dono de obra, incorporador, escritório) e **execução** (rede de fornecedores e serviços), com ferramentas que **qualificam, registram e encaminham** sem substituir o humano em decisões críticas.

---

## 2. Público-alvo (ICP) — com quem o SDR conversa

| Perfil | Sinais na conversa | Dor comum |
|--------|-------------------|-----------|
| **Construtor / incorporador** | Volume de unidades, cronograma, padronização | Escalar atendimento sem perder controle |
| **Arquiteto / escritório** | Projetos simultâneos, especificações | Alinhar cliente, prazo e fornecedores |
| **Dono de obra residencial** | Reforma ou obra única, orçamento definido | Comparar propostas e confiar nos prazos |
| **Fornecedor B2B (fábrica, distribuidor)** | Catálogo, logística, condições comerciais | Gerar demanda qualificada via parceiros |
| **Parceiro de plataforma** | Integração, campanhas, indicadores | Clareza sobre regras e SLAs de lead |

**O SDR não fecha contrato complexo sozinho:** qualifica, documenta e **marca próximo passo** (reunião com especialista, envio de material, visita técnica).

---

## 3. Proposta de valor (elevator pitch)

> *"A Obra10+ ajuda empresas do ramo de obra e reforma a **conversar melhor com o mercado**: CRM pensado para o setor, **agentes de IA** que seguem **playbooks** e **conhecimento auditável**, e canais como WhatsApp **ligados ao mesmo cadastro do lead** — para ninguém perder contexto entre vendas e operação."*

Variações curtas para WhatsApp (1–2 linhas):

- **Versão A:** "Somos uma plataforma para **construção e reformas no Brasil**: CRM + IA que qualifica leads e mantém histórico em um só lugar."
- **Versão B:** "Ajudamos a **transformar conversa em oportunidade**: menos retrabalho entre comercial e obras, mais registro e encaminhamento claro."

---

## 4. Oferta principal (camadas)

1. **Hub de agentes (IA)**  
   Agente configurável por **cargo** (ex.: primeiro contacto, suporte), com **conhecimento por secções**, integração com **ferramentas** e, quando ativado, **canal WhatsApp** (ex.: UAZAPI).

2. **CRM e operações**  
   Leads, contatos, ciclos programados ou sob interação, materiais (ex.: **playbook** exportado em Markdown no storage).

3. **Ecossistema multi-mercado**  
   Prefixos de mercado (ex.: imobiliário, arquitetura reforma, engenharia) para **adaptar linguagem** e prioridade nos prompts.

*Nota para o SDR:* não prometer funcionalidades que o cliente **não contratou** nem que **não estão ativas no tenant** dele. Usar formulários do tipo: "no seu pacote hoje, o que está incluído é…".

---

## 5. Fluxo SDR (primeiro contacto → qualificação)

### 5.1 Objetivos do agente humano ou IA neste papel

1. **Responder** em tempo útil (canal esperado pelo lead).  
2. **Identificar** perfil (ICP), urgência e autoridade de decisão.  
3. **Registrar** dados mínimos no CRM (nome, segmento, cidade, necessidade).  
4. **Agendar** ou **encaminhar** para demo, comercial sênior ou operações.

### 5.2 Perguntas obrigatórias (ordem sugestiva)

1. "É para **obra nova**, **reforma** ou **fornecimento B2B**?"  
2. "Qual **cidade/região** e **prazo** desejado?"  
3. "Quem **decide** o projeto — o senhor/a senhora ou outra pessoa?"  
4. "Já usa **CRM** ou **WhatsApp Business** para leads?"

### 5.3 Critérios de qualificação (exemplo)

- **Quente:** prazo &lt; 60 dias, orçamento mencionado, decisor na conversa.  
- **Morno:** interesse claro, prazo 60–180 dias.  
- **Frio:** apenas pesquisa ou canal errado → manter nutrição leve ou encerrar educadamente.

### 5.4 Escalação para humano

- **Negociação de preço** ou desconto fora de tabela.  
- **Contratos, jurídico, parcerias** com nível executivo.  
- **Reclamações** graves ou menções a órgão regulador.  
- Pedido de **cancelamento** ou **exclusão de dados** (tratar com compliance).

---

## 6. O que o SDR / agente **pode** dizer

- Explicar **visão geral** da Obra10+ e **como** CRM + IA se combinam.  
- Confirmar que **dados ficam** no ambiente do cliente (tenant), conforme contrato.  
- Enviar **link** para materiais oficiais ou **agendar** call.  
- Usar **tom profissional**, direto, em português (Brasil).

---

## 7. O que **não pode** fazer (guardrails)

- **Inventar** CNPJ, certificações, cases com nomes reais sem autorização.  
- **Garantir** prazo de obra ou resultado financeiro sem validação humana.  
- **Compartilhar** dados de outros clientes ou **credenciais**.  
- **Substituir** visita técnica, ART laudo ou assessoria legal.  
- Prometer integrações **não documentadas** no contrato do cliente.

---

## 8. Objeções frequentes e respostas modelo

**"É caro."**  
*"Entendo. O valor depende do **escopo** (usuários, canais, volume). Posso pedir ao comercial uma **faixa orientativa** para o seu caso — qual o tamanho aproximado da operação?"*

**"Já tenho CRM."**  
*"Perfeito — muitos clientes **integram** ou migram etapas aos poucos. O diferencial aqui é o **contexto de obra** e os **agentes** amarrados ao seu playbook. Quer comparar 2–3 necessidades suas com o que mostramos na demo?"*

**"IA vai errar."**  
*"Concordamos — por isso usamos **conhecimento estruturado**, limites claros e **escalação para humano**. A IA apoia na **primeira linha**, não substitui decisão crítica."*

**"Só quero WhatsApp."**  
*"O canal é uma peça; o importante é o **histórico no CRM** e as **regras** do agente. Posso explicar em 5 minutos como encaixa no seu fluxo atual?"*

**"Manda proposta fechada agora."**  
*"Consigo **agendar** com quem monta proposta com os números certos. Para não prometer nada impreciso, qual **email** e **melhor horário**?"*

---

## 9. Glossário rápido (para consistência nas respostas)

- **Tenant:** ambiente isolado do cliente na plataforma.  
- **Agente / cargo:** papel configurado (ex.: SDR, suporte) com conhecimento e ferramentas.  
- **Playbook:** documento/resumo operacional exportável (Markdown) alinhado ao agente.  
- **RAG / documentos:** trechos indexados para a IA consultar além do texto fixo das secções.  
- **Ciclo IA:** linha de automação (gatilho, contínuo ou programado) associada ao agente.

---

## 10. Assinatura e próximo passo (modelo)

*"Obrigado pelo contato com a **Obra10+**. Registei seu interesse em **[segmento]** para **[cidade]** — o próximo passo é **[demo / ligação / envio de material]**. Posso confirmar um **horário**?"*

---

**Fim do documento de exemplo.**
