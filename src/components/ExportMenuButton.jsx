import { Button, Menu, MenuButton, MenuItem, MenuList } from '@chakra-ui/react';
import { FiChevronDown, FiDownload } from 'react-icons/fi';

export default function ExportMenuButton({ label = 'Exportar', options = [], isDisabled }) {
  const enabled = (options || []).filter((o) => !o?.hidden);
  return (
    <Menu placement="bottom-end">
      <MenuButton
        as={Button}
        leftIcon={<FiDownload />}
        rightIcon={<FiChevronDown />}
        variant="solid"
        colorScheme="brand"
        size="sm"
        isDisabled={isDisabled || enabled.length === 0}
      >
        {label}
      </MenuButton>
      <MenuList>
        {enabled.map((opt) => (
          <MenuItem key={opt.id} onClick={opt.onClick} isDisabled={opt.disabled}>
            {opt.label}
          </MenuItem>
        ))}
      </MenuList>
    </Menu>
  );
}

