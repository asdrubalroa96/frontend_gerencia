import { Box, Image, Text as ChakraText } from '@chakra-ui/react';

/**
 * Logo SENIAT + subtítulo opcional.
 */
export default function SeniatBrandBlock({
  align = 'start',
  maxW = '220px',
  maxH = '72px',
  mb = 0,
  subtitle,
}) {
  return (
    <Box mb={mb} textAlign={align === 'center' ? 'center' : 'left'}>
      <Image
        src="/seniat-logo.png"
        alt="SENIAT — Servicio Nacional Integrado de Administración Aduanera y Tributaria"
        maxW={maxW}
        maxH={maxH}
        w="100%"
        h="auto"
        objectFit="contain"
        mx={align === 'center' ? 'auto' : 0}
        display="block"
        textAlign="right"
      />
      {subtitle ? (
        <ChakraText
          fontSize="xs"
          color="gray.500"
          mt={2}
          fontWeight="600"
          transform="rotate(360deg)"
          textAlign="center"
        >
          {subtitle}
        </ChakraText>
      ) : null}
    </Box>
  );
}
