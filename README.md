# Hikari Anime

Plugin de providers de anime para o **Nuvio**, com foco em uma seleção enxuta de fontes e qualidade de vídeo.

## Provider disponível

| Provider | Conteúdo | Qualidade |
| --- | --- | --- |
| AniZone | Filmes e séries de anime | Exclusivamente 1080p |

As opções de áudio disponíveis na fonte são preservadas. Streams sem identificação confiável de 1080p são descartadas.

## Provider planejado

O Tomato permanece planejado, mas não está incluído no manifest nesta versão. O scraper upstream consultado contém um JWT Bearer fixo associado a uma conta. Esse token não foi copiado para este repositório. A integração será retomada quando houver um método de autenticação apropriado que não dependa da reutilização de credenciais de terceiros.

## Instalação no Nuvio

1. Abra **Configurações → Conteúdo e descoberta → Plugins**.
2. Escolha **Adicionar repositório**.
3. Informe a URL do manifest:

   `https://raw.githubusercontent.com/robertmenezes/hikari-anime/main/manifest.json`

4. Atualize a lista e habilite AniZone.

> O repositório está privado durante a preparação. O Nuvio não consegue buscar o manifest de um repositório privado sem autenticação; antes da instalação, será necessário publicar o repositório ou hospedar o manifest em um endereço acessível ao app.

## Estrutura

```text
.
├── manifest.json
├── README.md
└── providers
    └── anizone.js
```

## Origem e atribuição

O provider AniZone desta versão foi adaptado a partir de:

- [Kamirama-Plugin — AniZone](https://github.com/kaminarizz/Kamirama-Plugin/blob/main/providers/anizone.js)

O repositório upstream consultado não continha um arquivo `LICENSE` na data da preparação desta cópia. Este README registra a origem do arquivo; não concede permissões adicionais nem declara uma licença para código de terceiros.

## Observações técnicas

- O AniZone só aceita uma playlist cuja maior resolução anunciada seja exatamente 1080p.
- Streams sem resolução identificável ou acima de 1080p são descartadas.
- O filtro é intencionalmente restritivo. A playlist HLS ainda precisa ser testada no Nuvio para verificar como o player escolhe as variantes internas.

O Hikari Anime não hospeda vídeos ou arquivos de mídia. O provider consulta fontes de terceiros; utilize-o de acordo com as leis e os termos aplicáveis.
