# syscall constants
PRINT_INT = 1
PRINT_CHAR = 11
PRINT_STRING = 4

.data
newline:    .asciiz "\n"		# useful for printing commands

a_string: .asciiz "this is my favorite string"
same_string: .asciiz "this is my favorite string"
different_string: .asciiz "this ISN'T my favorite string"
almost_same_string: .asciiz "this is my favorite string!"
empty_string: .asciiz ""

.text

my_strcmp:
	li	$t3, 0		# i = 0
my_strcmp_loop:
	add	$t0, $a0, $t3	# &str1[i]
	lb	$t0, 0($t0)	# c1 = str1[i]
	add	$t1, $a1, $t3	# &str2[i]
	lb	$t1, 0($t1)	# c2 = str2[i]

	beq	$t0, $t1, my_strcmp_equal
	sub	$v0, $t0, $t1	# c1 - c2
	jr	$ra

my_strcmp_equal:
	bne	$t0, $0, my_strcmp_not_done
	li	$v0, 0
	jr	$ra

my_strcmp_not_done:
	add	$t3, $t3, 1	# i ++
	j	my_strcmp_loop

rotate_string_in_place:
	sub	$sp, $sp, 8
	sw	$ra, 0($sp)
	sw	$a0, 4($sp)

	jal	my_strlen
	move	$t0, $v0	# length
	lw	$a0, 4($sp)
	lb	$t1, 0($a0)	# was_first = str[0]

	li	$t2, 1		# i = 1
rsip_loop:
	bge	$t2, $t0, rsip_done
	add	$t3, $a0, $t2	# &str[i]
	lb	$t4, 0($t3)	# char c = str[i]
	sb	$t4, -1($t3)	# str[i - 1] = c
	add	$t2, $t2, 1	# i ++
	j	rsip_loop		
	
rsip_done:
	add	$t3, $a0, $t0	# &str[length]
	sb	$t1, -1($t3)	# str[length - 1] = was_first
	lw	$ra, 0($sp)
	add	$sp, $sp, 8
	jr	$ra

print_int_and_space:
	li	$v0, PRINT_INT	# load the syscall option for printing ints
	syscall			# print the number

	li   	$a0, ' '       	# print a black space
	li	$v0, PRINT_CHAR	# load the syscall option for printing chars
	syscall			# print the char
	
	jr	$ra		# return to the calling procedure

print_string:
	li	$v0, PRINT_STRING	# print string command
	syscall	     			# string is in $a0
	jr	$ra

print_newline:
	la	$a0, newline		# print a newline char.
	li	$v0, PRINT_STRING	
	syscall	
	jr	$ra

my_strlen:
	li	$v0, 0			# length = 0  (in $v0 'cause return val)
my_strlen_loop:
	add	$t1, $a0, $v0		# &str[length]
	lb	$t2, 0($t1)		# str[length]
	beq	$t2, $0, my_strlen_done
	
	add	$v0, $v0, 1		# length ++
	j 	my_strlen_loop

my_strlen_done:
	jr	$ra

main:
	sub	$sp, $sp, 4
	sw	$ra, 0($sp)		# save $ra on stack

	la	$a0, a_string		
	jal	my_strlen
	move	$a0, $v0
	jal	print_int_and_space	# this should print 26
	
	la	$a0, a_string		
	la	$a1, same_string		
	jal	my_strcmp
	move	$a0, $v0
	jal	print_int_and_space	# this should print 0
	
	la	$a0, a_string		
	la	$a1, different_string
	jal	my_strcmp
	move	$a0, $v0
	jal	print_int_and_space	# this should print 32

	la	$a0, a_string		
	la	$a1, almost_same_string
	jal	my_strcmp
	move	$a0, $v0
	jal	print_int_and_space	# this should print -33
	jal	print_newline

	la	$a0, a_string
	jal	rotate_string_in_place
	la	$a0, a_string
	# this should print "his is my favorite stringt"
	jal	print_string		
	jal	print_newline

	lw	$ra, 0($sp)
	add	$sp, $sp, 4
	jr	$ra